package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

var ErrUserScopeRequired = errors.New("ai adapter requires authenticated user scope")

type CostLimitError struct {
	UserID      string
	Limit       int
	WindowStart time.Time
}

func (e *CostLimitError) Error() string {
	return fmt.Sprintf("ai daily call cap exceeded for user %s: limit %d", e.UserID, e.Limit)
}

func (e *CostLimitError) RetryAt() time.Time {
	return e.WindowStart.Add(24 * time.Hour)
}

func IsCostLimitError(err error) bool {
	var target *CostLimitError
	return errors.As(err, &target)
}

type Meter struct {
	mu       sync.Mutex
	dailyCap int
	now      func() time.Time
	calls    map[string]int
}

func NewMeter() *Meter {
	return newMeter(values.AiDailyCallCap, nil)
}

func newMeter(dailyCap int, now func() time.Time) *Meter {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return &Meter{
		dailyCap: dailyCap,
		now:      now,
		calls:    make(map[string]int),
	}
}

func (m *Meter) UserID(ctx context.Context) (string, error) {
	userID, ok := platform.UserIDFromContext(ctx)
	if !ok {
		return "", ErrUserScopeRequired
	}
	return userID, nil
}

func (m *Meter) Charge(ctx context.Context) (string, error) {
	userID, err := m.UserID(ctx)
	if err != nil {
		return "", err
	}
	now := m.now().UTC()
	windowStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	currentWindow := windowStart.Format(time.DateOnly)
	key := userID + "|" + currentWindow

	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked(currentWindow)
	if m.calls[key] >= m.dailyCap {
		return "", &CostLimitError{
			UserID:      userID,
			Limit:       m.dailyCap,
			WindowStart: windowStart,
		}
	}
	m.calls[key]++
	return userID, nil
}

func (m *Meter) pruneLocked(currentWindow string) {
	suffix := "|" + currentWindow
	for key := range m.calls {
		if !strings.HasSuffix(key, suffix) {
			delete(m.calls, key)
		}
	}
}

// The metering decorators wrap the capability interfaces so the per-call token cap,
// the daily call cap, and identical-input caching apply uniformly to every provider
// (A6). The mock adapters bypass this seam entirely — they are never wrapped. Each
// decorator resolves the caller from context, serves an identical prior call from the
// cache without charging, and only charges the daily cap on a real provider call.

type meteredLLMClient struct {
	inner LLMClient
	meter *Meter
	mu    sync.Mutex
	cache boundedCache[[]byte]
}

func newMeteredLLMClient(inner LLMClient, meter *Meter) *meteredLLMClient {
	return &meteredLLMClient{
		inner: inner,
		meter: meter,
		cache: newBoundedCache[[]byte](aiAdapterCacheMaxEntries),
	}
}

func (c *meteredLLMClient) CompleteJSON(ctx context.Context, req LLMRequest) (LLMResponse, error) {
	userID, err := c.meter.UserID(ctx)
	if err != nil {
		return LLMResponse{}, err
	}
	key := stableHash(userID, req.CacheKey)
	if cached, ok := c.get(key); ok {
		return LLMResponse{JSON: cached}, nil
	}
	if _, err := c.meter.Charge(ctx); err != nil {
		return LLMResponse{}, err
	}
	req.UserID = userID
	req.MaxOutputTokens = values.AiPerCallTokenCap
	resp, err := c.inner.CompleteJSON(ctx, req)
	if err != nil {
		return LLMResponse{}, err
	}
	if req.Validate != nil {
		if err := req.Validate(resp.JSON); err != nil {
			// A response the consumer rejects is not cached — the identical input can
			// re-sample on retry instead of being served a poisoned cache entry.
			return LLMResponse{}, err
		}
	}
	c.put(key, resp.JSON)
	return LLMResponse{JSON: append([]byte(nil), resp.JSON...)}, nil
}

func (c *meteredLLMClient) get(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	value, ok := c.cache.get(key)
	if !ok {
		return nil, false
	}
	return append([]byte(nil), value...), true
}

func (c *meteredLLMClient) put(key string, value []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache.put(key, append([]byte(nil), value...))
}

type meteredEmbeddingClient struct {
	inner EmbeddingClient
	meter *Meter
	mu    sync.Mutex
	cache boundedCache[[][]float32]
}

func newMeteredEmbeddingClient(inner EmbeddingClient, meter *Meter) *meteredEmbeddingClient {
	return &meteredEmbeddingClient{
		inner: inner,
		meter: meter,
		cache: newBoundedCache[[][]float32](aiAdapterCacheMaxEntries),
	}
}

func (c *meteredEmbeddingClient) Embed(ctx context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	userID, err := c.meter.UserID(ctx)
	if err != nil {
		return EmbeddingResponse{}, err
	}
	key := stableHash(userID, req.CacheKey)
	if cached, ok := c.get(key); ok {
		return EmbeddingResponse{Vectors: cached}, nil
	}
	if _, err := c.meter.Charge(ctx); err != nil {
		return EmbeddingResponse{}, err
	}
	req.UserID = userID
	resp, err := c.inner.Embed(ctx, req)
	if err != nil {
		return EmbeddingResponse{}, err
	}
	if req.Validate != nil {
		if err := req.Validate(resp.Vectors); err != nil {
			return EmbeddingResponse{}, err
		}
	}
	c.put(key, resp.Vectors)
	return EmbeddingResponse{Vectors: copyVectors(resp.Vectors)}, nil
}

func (c *meteredEmbeddingClient) get(key string) ([][]float32, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	vectors, ok := c.cache.get(key)
	if !ok {
		return nil, false
	}
	return copyVectors(vectors), true
}

func (c *meteredEmbeddingClient) put(key string, vectors [][]float32) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache.put(key, copyVectors(vectors))
}
