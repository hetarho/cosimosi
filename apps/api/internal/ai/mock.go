package ai

import (
	"context"
	"hash/fnv"
	"math"
	"math/rand"
)

// MockEmbedder produces a deterministic, L2-normalized vector seeded by the text
// hash — no API key required, so the whole pipeline runs keyless (acceptance
// 3.1). Identical text always yields the same vector (cos_sim 1.0); different
// texts are ~orthogonal (cos_sim ≈ 0). It models stability, not semantics —
// semantic nearness is the OpenAI embedder's job.
type MockEmbedder struct {
	dim int
}

// NewMockEmbedder builds a mock embedder emitting dim-length unit vectors.
func NewMockEmbedder(dim int) *MockEmbedder {
	return &MockEmbedder{dim: dim}
}

func (m *MockEmbedder) Dim() int      { return m.dim }
func (m *MockEmbedder) Model() string { return "mock" }

// Embed returns a deterministic unit vector for text. Seeding math/rand from the
// FNV-1a hash of the text makes it reproducible across processes and runs.
func (m *MockEmbedder) Embed(_ context.Context, text string) ([]float32, error) {
	h := fnv.New64a()
	_, _ = h.Write([]byte(text))
	rng := rand.New(rand.NewSource(int64(h.Sum64()))) //nolint:gosec // deterministic seed, not security

	vec := make([]float32, m.dim)
	var sumSq float64
	for i := range vec {
		v := rng.NormFloat64()
		vec[i] = float32(v)
		sumSq += v * v
	}
	norm := math.Sqrt(sumSq)
	if norm == 0 {
		// Degenerate (effectively impossible with NormFloat64) — return a unit basis vector.
		if len(vec) > 0 {
			vec[0] = 1
		}
		return vec, nil
	}
	inv := float32(1.0 / norm)
	for i := range vec {
		vec[i] *= inv
	}
	return vec, nil
}
