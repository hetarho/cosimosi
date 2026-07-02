package ai

import (
	"context"
	"errors"
	"fmt"

	"github.com/cosimosi/api/internal/platform/values"
)

var ErrEmbeddingClientRequired = errors.New("ai real embedder requires an embedding client")

// RealEmbedder owns the domain contract — the target dimension and the row-shape
// check. It consumes the metering-wrapped capability interface; caps and caching
// live at that seam, not here (§2.4 / A6).
type RealEmbedder struct {
	client EmbeddingClient
}

func NewRealEmbedder(client EmbeddingClient) (*RealEmbedder, error) {
	if client == nil {
		return nil, ErrEmbeddingClientRequired
	}
	return &RealEmbedder{client: client}, nil
}

func (e *RealEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	key := stableHash("embed", texts, values.AiEmbeddingDim)
	want := len(texts)
	resp, err := e.client.Embed(ctx, EmbeddingRequest{
		Texts:    append([]string(nil), texts...),
		Dim:      values.AiEmbeddingDim,
		CacheKey: key,
		Validate: func(vectors [][]float32) error { return validateVectors(vectors, want) },
	})
	if err != nil {
		return nil, err
	}
	if err := validateVectors(resp.Vectors, len(texts)); err != nil {
		return nil, err
	}
	return copyVectors(resp.Vectors), nil
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
