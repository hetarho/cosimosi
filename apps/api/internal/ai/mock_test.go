package ai

import (
	"context"
	"math"
	"testing"
)

func TestMockEmbedderDim(t *testing.T) {
	m := NewMockEmbedder(1536)
	if m.Dim() != 1536 {
		t.Fatalf("Dim() = %d, want 1536", m.Dim())
	}
	vec, err := m.Embed(context.Background(), "hello universe")
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if len(vec) != 1536 {
		t.Fatalf("len(vec) = %d, want 1536", len(vec))
	}
}

func TestMockEmbedderDeterministic(t *testing.T) {
	m := NewMockEmbedder(64)
	a, _ := m.Embed(context.Background(), "오늘 첫 번째 별을 만들었다")
	b, _ := m.Embed(context.Background(), "오늘 첫 번째 별을 만들었다")
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("same text produced different vectors at %d: %v != %v", i, a[i], b[i])
		}
	}
}

func TestMockEmbedderUnitNorm(t *testing.T) {
	m := NewMockEmbedder(1536)
	vec, _ := m.Embed(context.Background(), "any text")
	var sumSq float64
	for _, v := range vec {
		sumSq += float64(v) * float64(v)
	}
	norm := math.Sqrt(sumSq)
	if math.Abs(norm-1.0) > 1e-4 {
		t.Fatalf("L2 norm = %f, want ~1.0", norm)
	}
}

func TestMockEmbedderDifferentTextDiffers(t *testing.T) {
	m := NewMockEmbedder(1536)
	a, _ := m.Embed(context.Background(), "first")
	b, _ := m.Embed(context.Background(), "second")
	var dot float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
	}
	// Two independent random unit vectors in high dimension are near-orthogonal.
	if math.Abs(dot) > 0.2 {
		t.Fatalf("distinct texts unexpectedly similar: cos_sim = %f", dot)
	}
}
