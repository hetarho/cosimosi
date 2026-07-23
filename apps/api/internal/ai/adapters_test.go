package ai

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestMockAdaptersAreDeterministicOffline(t *testing.T) {
	clearProviderEnv(t)

	adapters, err := NewAdaptersFromEnv(FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdaptersFromEnv failed: %v", err)
	}
	if adapters.Mode != "llm=mock embedding=mock" {
		t.Fatalf("mode = %q, want llm=mock embedding=mock", adapters.Mode)
	}

	ctx := context.Background()
	body := "Walked through the blue market and met Mina"
	firstSplit, err := adapters.Extractor.Split(ctx, body, time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil)
	if err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	secondSplit, err := adapters.Extractor.Split(ctx, body, time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil)
	if err != nil {
		t.Fatalf("second Split failed: %v", err)
	}
	if !reflect.DeepEqual(firstSplit, secondSplit) {
		t.Fatalf("mock Split is not deterministic:\nfirst=%+v\nsecond=%+v", firstSplit, secondSplit)
	}

	firstEmbedding, err := adapters.Embedder.Embed(ctx, []string{"blue market"})
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if len(firstEmbedding) != 1 || len(firstEmbedding[0]) != values.AiEmbeddingDim {
		t.Fatalf("embedding dimensions = %d vectors, %d dim", len(firstEmbedding), len(firstEmbedding[0]))
	}
}

// The mock adapters bypass the metering seam — repeated calls beyond the daily cap
// never trip a cost limit and never require a user scope (A6: the mock is unmetered).
func TestMockAdaptersAreUnmetered(t *testing.T) {
	clearProviderEnv(t)
	adapters, err := NewAdaptersFromEnv(FactoryOptions{Meter: newMeter(1, fixedNow)})
	if err != nil {
		t.Fatalf("NewAdaptersFromEnv failed: %v", err)
	}
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		if _, err := adapters.Extractor.Split(ctx, fmt.Sprintf("market-%d", i), fixedNow(), nil); err != nil {
			t.Fatalf("mock Split %d failed: %v", i, err)
		}
	}
}

func TestExtractorSchemaForcedDTOHasNoInvariantBreakingFields(t *testing.T) {
	banned := map[string]bool{
		"position": true,
		"color":    true,
		"strength": true,
		"time":     true,
		"delete":   true,
	}
	for _, typ := range []reflect.Type{
		reflect.TypeOf(memory.ExtractResult{}),
		reflect.TypeOf(memory.ExtractedMemory{}),
		reflect.TypeOf(memory.ExtractedNeuron{}),
	} {
		for i := 0; i < typ.NumField(); i++ {
			field := typ.Field(i)
			if banned[strings.ToLower(field.Name)] {
				t.Fatalf("%s has banned field %s", typ.Name(), field.Name)
			}
		}
	}
}

// The metering seam wraps every real LLM path: the per-call token cap is applied to the
// vendor request, the daily cap trips on distinct inputs, and an identical input is
// served from cache without re-billing.
func TestMeteredLLMSeamAppliesTokenCapCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(1, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}

	if _, err := extractor.Split(ctx, "market", fixedNow(), nil); err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	if client.calls != 1 || client.lastRequest.MaxOutputTokens != values.AiPerCallTokenCap {
		t.Fatalf("client calls=%d cap=%d", client.calls, client.lastRequest.MaxOutputTokens)
	}
	if client.lastRequest.UserID != "user-1" {
		t.Fatalf("seam did not scope request to caller, userID=%q", client.lastRequest.UserID)
	}

	if _, err := extractor.Split(ctx, "market", fixedNow(), nil); err != nil {
		t.Fatalf("cached Split failed: %v", err)
	}
	if client.calls != 1 {
		t.Fatalf("cached Split re-billed: calls=%d", client.calls)
	}

	if _, err := extractor.Split(ctx, "different market", fixedNow(), nil); !IsCostLimitError(err) {
		t.Fatalf("different Split error = %v, want CostLimitError", err)
	}
}

func TestMeteredLLMSeamRequiresUserScope(t *testing.T) {
	client := &fakeLLMClient{response: []byte(`{}`)}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(10, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}
	if _, err := extractor.Split(context.Background(), "market", fixedNow(), nil); err == nil {
		t.Fatal("Split without user scope succeeded, want ErrUserScopeRequired")
	}
}

func TestMeteredEmbeddingSeamAppliesDimensionCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeEmbeddingClient{}
	embedder, err := NewRealEmbedder(newMeteredEmbeddingClient(client, newMeter(1, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealEmbedder failed: %v", err)
	}

	vectors, err := embedder.Embed(ctx, []string{"market"})
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if len(vectors) != 1 || len(vectors[0]) != values.AiEmbeddingDim {
		t.Fatalf("embedding shape = %d vectors dim %d", len(vectors), len(vectors[0]))
	}
	if client.calls != 1 || client.lastRequest.Dim != values.AiEmbeddingDim {
		t.Fatalf("client calls=%d dim=%d", client.calls, client.lastRequest.Dim)
	}

	if _, err := embedder.Embed(ctx, []string{"market"}); err != nil {
		t.Fatalf("cached Embed failed: %v", err)
	}
	if client.calls != 1 {
		t.Fatalf("cached Embed re-billed: calls=%d", client.calls)
	}

	if _, err := embedder.Embed(ctx, []string{"different market"}); !IsCostLimitError(err) {
		t.Fatalf("different Embed error = %v, want CostLimitError", err)
	}
}

// A response the consumer rejects must not be cached, so an identical retry re-invokes
// the provider (and can re-sample) rather than being served a poisoned cache entry.
func TestMeteredSeamDoesNotCacheRejectedResponses(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	reject := errors.New("consumer rejected the response")

	llm := &fakeLLMClient{response: []byte(`{"valid":"but unusable"}`)}
	llmSeam := newMeteredLLMClient(llm, newMeter(10, fixedNow))
	llmReq := LLMRequest{CacheKey: "k", Validate: func([]byte) error { return reject }}
	for i := 0; i < 2; i++ {
		if _, err := llmSeam.CompleteJSON(ctx, llmReq); !errors.Is(err, reject) {
			t.Fatalf("llm attempt %d error = %v, want rejection", i, err)
		}
	}
	if llm.calls != 2 {
		t.Fatalf("llm inner calls = %d, want 2 (rejected response must not be cached)", llm.calls)
	}

	emb := &fakeEmbeddingClient{}
	embSeam := newMeteredEmbeddingClient(emb, newMeter(10, fixedNow))
	embReq := EmbeddingRequest{Texts: []string{"x"}, Dim: values.AiEmbeddingDim, CacheKey: "k", Validate: func([][]float32) error { return reject }}
	for i := 0; i < 2; i++ {
		if _, err := embSeam.Embed(ctx, embReq); !errors.Is(err, reject) {
			t.Fatalf("embedding attempt %d error = %v, want rejection", i, err)
		}
	}
	if emb.calls != 2 {
		t.Fatalf("embedding inner calls = %d, want 2 (rejected response must not be cached)", emb.calls)
	}
}

func TestBoundedCacheEvictsOldestEntries(t *testing.T) {
	cache := newBoundedCache[string](2)
	cache.put("a", "first")
	cache.put("b", "second")
	cache.put("c", "third")

	if _, ok := cache.get("a"); ok {
		t.Fatal("oldest cache entry was not evicted")
	}
	if got, ok := cache.get("b"); !ok || got != "second" {
		t.Fatalf("cache b = %q %v, want second true", got, ok)
	}
	if got, ok := cache.get("c"); !ok || got != "third" {
		t.Fatalf("cache c = %q %v, want third true", got, ok)
	}
}

func TestMeteredLLMSeamCacheIsBounded(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(aiAdapterCacheMaxEntries+10, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}
	day := fixedNow()
	for i := 0; i < aiAdapterCacheMaxEntries+1; i++ {
		if _, err := extractor.Split(ctx, fmt.Sprintf("market-%d", i), day, nil); err != nil {
			t.Fatalf("Split %d failed: %v", i, err)
		}
	}
	if _, err := extractor.Split(ctx, "market-0", day, nil); err != nil {
		t.Fatalf("evicted Split failed: %v", err)
	}
	if client.calls != aiAdapterCacheMaxEntries+2 {
		t.Fatalf("client calls = %d, want oldest entry evicted and reloaded", client.calls)
	}
}

func TestMeterPrunesOldDailyWindows(t *testing.T) {
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	meter := newMeter(10, func() time.Time { return now })
	ctx := platform.ContextWithUserID(context.Background(), "user-1")

	if _, err := meter.Charge(ctx); err != nil {
		t.Fatalf("first Charge failed: %v", err)
	}
	now = now.Add(24 * time.Hour)
	if _, err := meter.Charge(ctx); err != nil {
		t.Fatalf("second Charge failed: %v", err)
	}
	if len(meter.calls) != 1 {
		t.Fatalf("meter call windows = %d, want only current window", len(meter.calls))
	}
}

func clearProviderEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		EnvLLMProvider, EnvLLMAPIKey, EnvLLMModel,
		EnvEmbeddingProvider, EnvEmbeddingAPIKey, EnvEmbeddingModel,
	} {
		t.Setenv(key, "")
	}
}

type fakeLLMClient struct {
	response    []byte
	calls       int
	lastRequest LLMRequest
}

func (c *fakeLLMClient) CompleteJSON(_ context.Context, req LLMRequest) (LLMResponse, error) {
	c.calls++
	c.lastRequest = req
	return LLMResponse{JSON: append([]byte(nil), c.response...)}, nil
}

type fakeEmbeddingClient struct {
	calls       int
	lastRequest EmbeddingRequest
}

func (c *fakeEmbeddingClient) Embed(_ context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	c.calls++
	c.lastRequest = req
	vectors := make([][]float32, 0, len(req.Texts))
	for range req.Texts {
		vector := make([]float32, req.Dim)
		vector[0] = 0.5
		vectors = append(vectors, vector)
	}
	return EmbeddingResponse{Vectors: vectors}, nil
}

func fixedNow() time.Time {
	return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
}
