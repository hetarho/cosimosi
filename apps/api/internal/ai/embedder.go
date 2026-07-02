package ai

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/cosimosi/api/internal/platform/values"
)

var ErrEmbeddingClientRequired = errors.New("ai real embedder requires an embedding client")

type RealEmbedder struct {
	client EmbeddingClient
	meter  *Meter
	mu     sync.Mutex
	cache  boundedCache[[][]float32]
}

func NewRealEmbedder(client EmbeddingClient, meter *Meter) (*RealEmbedder, error) {
	if client == nil {
		return nil, ErrEmbeddingClientRequired
	}
	if meter == nil {
		meter = NewMeter()
	}
	return &RealEmbedder{
		client: client,
		meter:  meter,
		cache:  newBoundedCache[[][]float32](aiAdapterCacheMaxEntries),
	}, nil
}

func (e *RealEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	userID, err := e.meter.UserID(ctx)
	if err != nil {
		return nil, err
	}
	key := stableHash("embed", userID, texts, values.AiEmbeddingDim)
	if cached, ok := e.cached(key); ok {
		return cached, nil
	}
	userID, err = e.meter.Charge(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := e.client.Embed(ctx, EmbeddingRequest{
		UserID:   userID,
		Texts:    append([]string(nil), texts...),
		Dim:      values.AiEmbeddingDim,
		CacheKey: key,
	})
	if err != nil {
		return nil, err
	}
	if err := validateVectors(resp.Vectors, len(texts)); err != nil {
		return nil, err
	}
	e.store(key, resp.Vectors)
	return copyVectors(resp.Vectors), nil
}

func (e *RealEmbedder) cached(key string) ([][]float32, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	vectors, ok := e.cache.get(key)
	return copyVectors(vectors), ok
}

func (e *RealEmbedder) store(key string, vectors [][]float32) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cache.put(key, copyVectors(vectors))
}

func validateVectors(vectors [][]float32, want int) error {
	if len(vectors) != want {
		return fmt.Errorf("embedding client returned %d vectors for %d texts", len(vectors), want)
	}
	for i, vector := range vectors {
		if len(vector) != values.AiEmbeddingDim {
			return fmt.Errorf("embedding vector %d dimension = %d, want %d", i, len(vector), values.AiEmbeddingDim)
		}
	}
	return nil
}

func copyVectors(vectors [][]float32) [][]float32 {
	if vectors == nil {
		return nil
	}
	copied := make([][]float32, len(vectors))
	for i, vector := range vectors {
		copied[i] = append([]float32(nil), vector...)
	}
	return copied
}
