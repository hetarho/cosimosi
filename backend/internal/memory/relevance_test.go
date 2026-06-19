package memory

import (
	"testing"
	"time"
)

// vec is a tiny helper: a star with embedding `emb`, last active `daysAgo` before `now`.
func vec(now time.Time, id string, emb []float64, intensity, daysAgo float64) StarVector {
	return StarVector{
		ID:             id,
		Embedding:      emb,
		Intensity:      intensity,
		LastRecalledAt: now.Add(-time.Duration(daysAgo * 24 * float64(time.Hour))),
	}
}

// 26: an empty universe — or one where no star has an embedding yet — scores every star
// neutral (relevance 0), so the client's R_recent folds to the no-op 1.0.
func TestRelevanceByStarEmptyIsNeutral(t *testing.T) {
	now := time.Now().UTC()
	if got := RelevanceByStar(nil, now); len(got) != 0 {
		t.Fatalf("nil input → %v, want empty map", got)
	}
	// Stars present but no embeddings (embed jobs pending) → all 0.
	noEmb := RelevanceByStar([]StarVector{
		vec(now, "a", nil, 0.9, 0),
		vec(now, "b", []float64{}, 0.5, 1),
	}, now)
	if noEmb["a"] != 0 || noEmb["b"] != 0 {
		t.Fatalf("no-embedding universe → %v, want all 0", noEmb)
	}
	// Embeddings present but every intensity 0 → zero weight → no centroid → all 0.
	zeroInt := RelevanceByStar([]StarVector{
		vec(now, "a", []float64{1, 0}, 0, 0),
		vec(now, "b", []float64{0, 1}, 0, 0),
	}, now)
	if zeroInt["a"] != 0 || zeroInt["b"] != 0 {
		t.Fatalf("zero-intensity universe → %v, want all 0 (no topic weight)", zeroInt)
	}
}

// 26 (1.4): a star aligned with the recent "요즘 토픽" centroid resists decay (relevance↑),
// an orthogonal one is ~0, and a star pointing AGAINST the topic clamps to 0 (never negative,
// so λ_eff can't accelerate). A star without an embedding stays neutral 0.
func TestRelevanceByStarAlignment(t *testing.T) {
	now := time.Now().UTC()
	// A strong, fresh star defines the topic direction [1,0,0].
	rel := RelevanceByStar([]StarVector{
		vec(now, "topic", []float64{1, 0, 0}, 0.9, 0),
		vec(now, "aligned", []float64{1, 0, 0}, 0.1, 30),  // old but same theme
		vec(now, "ortho", []float64{0, 1, 0}, 0.1, 30),    // unrelated theme
		vec(now, "against", []float64{-1, 0, 0}, 0.05, 30), // opposite theme
		vec(now, "pending", nil, 0.5, 0),                   // no embedding yet
	}, now)

	if rel["aligned"] <= 0.9 {
		t.Fatalf("aligned relevance = %v, want >0.9", rel["aligned"])
	}
	if rel["ortho"] >= 0.1 {
		t.Fatalf("orthogonal relevance = %v, want <0.1", rel["ortho"])
	}
	if rel["against"] != 0 {
		t.Fatalf("opposite relevance = %v, want clamped to 0 (no decay acceleration)", rel["against"])
	}
	if rel["pending"] != 0 {
		t.Fatalf("embeddingless relevance = %v, want neutral 0", rel["pending"])
	}
	for id, v := range rel {
		if v < 0 || v > 1 {
			t.Fatalf("relevance[%s] = %v out of [0,1]", id, v)
		}
	}
}

// Recency·intensity weighting (intensity·exp(-Δt/τ)): the topic centroid leans toward
// the recent/strong star, so a star aligned with TODAY's theme scores higher than one aligned
// only with a faint, long-ago theme.
func TestRelevanceByStarRecencyWeighted(t *testing.T) {
	now := time.Now().UTC()
	rel := RelevanceByStar([]StarVector{
		vec(now, "recent_theme", []float64{1, 0, 0}, 0.9, 0),  // dominates the centroid
		vec(now, "old_theme", []float64{0, 0, 1}, 0.4, 40),    // faint, long ago
		vec(now, "near_recent", []float64{1, 0, 0}, 0.2, 2),   // matches today
		vec(now, "near_old", []float64{0, 0, 1}, 0.2, 2),      // matches the faded theme
	}, now)
	if !(rel["near_recent"] > rel["near_old"]) {
		t.Fatalf("today's theme (%v) should outscore the faded theme (%v)", rel["near_recent"], rel["near_old"])
	}
}
