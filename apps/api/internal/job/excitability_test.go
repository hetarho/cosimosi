package job

import (
	"testing"
	"time"
)

// 1.2 — a cluster active ~3h ago is strongly excitable; one active ~24h ago is ≈0,
// so the ~6h window (τ=6h, half-life ≈4h) makes "recent" decisively beat "yesterday".
func TestExcitabilityDecaysOverTheWindow(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	recent := excitability(now, []time.Time{now.Add(-3 * time.Hour)})
	stale := excitability(now, []time.Time{now.Add(-24 * time.Hour)})

	if recent <= stale {
		t.Fatalf("3h-ago excitability %.4f should exceed 24h-ago %.4f", recent, stale)
	}
	// 3h ago: exp(-0.5) ≈ 0.607 — strong bias.
	if recent < 0.5 {
		t.Fatalf("3h-ago excitability %.4f too weak (want ≥0.5 within the ~6h window)", recent)
	}
	// 24h ago: exp(-4) ≈ 0.018 — effectively no bias a day later.
	if stale > 0.05 {
		t.Fatalf("24h-ago excitability %.4f should be ≈0 (a day past the window)", stale)
	}
}

// A future timestamp (clock skew) clamps to Δt=0 (weight 1), never >1; zero-value
// timestamps are skipped, not counted as the epoch.
func TestExcitabilityGuards(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	future := excitability(now, []time.Time{now.Add(2 * time.Hour)})
	if future < 0.999 || future > 1.001 {
		t.Fatalf("future event excitability %.4f should clamp to 1.0", future)
	}
	if zero := excitability(now, []time.Time{{}}); zero != 0 {
		t.Fatalf("zero-value timestamp excitability %.4f should be skipped (0)", zero)
	}
}

// 1.1 — given equally-similar candidates in two clusters, the link goes to the
// recently-active (more excitable) cluster.
func TestBiasedLinksPrefersHotCluster(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	date := day("2026-06-13")
	cands := []Neighbor{
		{MemoryID: "hot", CosSim: 0.80, EntryDate: date},
		{MemoryID: "cold", CosSim: 0.80, EntryDate: date},
	}
	clusterOf := map[string]string{"hot": "C_hot", "cold": "C_cold"}
	clusterE := map[string]float64{"C_hot": 1.0, "C_cold": 0.0}

	links := biasedLinks("self", "u", date, now, cands, clusterOf, clusterE, 0, 0, 0)
	if len(links) != 2 {
		t.Fatalf("got %d links, want 2", len(links))
	}
	// Equal cos_sim → the hotter cluster's candidate is selected first.
	if links[0].BID != "hot" {
		t.Fatalf("first link = %q, want the hot-cluster candidate", links[0].BID)
	}
}

// 1.3 — soft inhibition: when several candidates crowd into one hot cluster, the
// selection still reaches into a colder cluster instead of taking all from the hot one.
func TestBiasedLinksSoftInhibitionSpreads(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	date := day("2026-06-13")
	// Three slightly-stronger candidates in the hot cluster, one weaker in a cold cluster.
	cands := []Neighbor{
		{MemoryID: "h1", CosSim: 0.82, EntryDate: date},
		{MemoryID: "h2", CosSim: 0.81, EntryDate: date},
		{MemoryID: "h3", CosSim: 0.80, EntryDate: date},
		{MemoryID: "c1", CosSim: 0.78, EntryDate: date},
	}
	clusterOf := map[string]string{"h1": "HOT", "h2": "HOT", "h3": "HOT", "c1": "COLD"}
	clusterE := map[string]float64{"HOT": 1.0, "COLD": 0.0}

	withInhibition := biasedLinks("self", "u", date, now, cands, clusterOf, clusterE, 0, 0, 0)
	picked := map[string]bool{}
	for _, l := range withInhibition {
		picked[l.BID] = true
	}
	// Without inhibition the hot cluster's bias would crowd out the colder candidate
	// even though it is genuinely similar; soft inhibition must let "c1" in.
	if !picked["c1"] {
		t.Fatalf("soft inhibition failed to spread: cold-cluster candidate not selected (%v)", picked)
	}
}

// 1.4 — fallback: no excitability (all zero) ⇒ pure cos_sim order, no panic, capped
// at biasedK.
func TestBiasedLinksFallbackToCosSim(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	date := day("2026-06-13")
	cands := []Neighbor{
		{MemoryID: "a", CosSim: 0.90, EntryDate: date},
		{MemoryID: "b", CosSim: 0.85, EntryDate: date},
		{MemoryID: "c", CosSim: 0.80, EntryDate: date},
	}
	clusterOf := map[string]string{"a": "A", "b": "B", "c": "C"}
	clusterE := map[string]float64{} // all zero

	links := biasedLinks("self", "u", date, now, cands, clusterOf, clusterE, 0, 0, 0)
	want := []string{"a", "b", "c"}
	if len(links) != len(want) {
		t.Fatalf("got %d links, want %d", len(links), len(want))
	}
	for i, w := range want {
		if links[i].BID != w {
			t.Fatalf("link[%d] = %q, want %q (cos_sim descending)", i, links[i].BID, w)
		}
	}
}

// biasedLinks caps the result at biasedK even with more candidates (candidateK pool).
func TestBiasedLinksCapsAtBiasedK(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	date := day("2026-06-13")
	cands := make([]Neighbor, 0, candidateK)
	clusterOf := map[string]string{}
	for i := 0; i < candidateK; i++ {
		id := string(rune('a' + i))
		cands = append(cands, Neighbor{MemoryID: id, CosSim: 0.9 - float64(i)*0.01, EntryDate: date})
		clusterOf[id] = id
	}
	links := biasedLinks("self", "u", date, now, cands, clusterOf, map[string]float64{}, 0, 0, 0)
	if len(links) != biasedK {
		t.Fatalf("got %d links, want biasedK=%d", len(links), biasedK)
	}
}

// spec 25 wiring — user-level arousal scales only the excitability term:
// W_EXC becomes W_EXC·ExcitabilityGain(arousal), so a hot cluster can outrank a
// slightly closer cold neighbor when the user's "요즘" is highly aroused.
func TestBiasedLinksArousalScalesExcitabilityTerm(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	date := day("2026-06-13")
	cands := []Neighbor{
		{MemoryID: "hot", CosSim: 0.72, EntryDate: date},
		{MemoryID: "cold", CosSim: 0.98, EntryDate: date},
	}
	clusterOf := map[string]string{"hot": "HOT", "cold": "COLD"}
	clusterE := map[string]float64{"HOT": 1.0, "COLD": 0.0}

	rest := biasedLinks("self", "u", date, now, cands, clusterOf, clusterE, 0, 0, 0)
	aroused := biasedLinks("self", "u", date, now, cands, clusterOf, clusterE, 1, 0, 0)
	if rest[0].BID != "cold" {
		t.Fatalf("at rest first link = %q, want cold semantic winner", rest[0].BID)
	}
	if aroused[0].BID != "hot" {
		t.Fatalf("with arousal first link = %q, want hot-cluster winner", aroused[0].BID)
	}
}

// deriveClusters groups candidates joined (even transitively, via a non-candidate
// connector) by synapses into one component; an unlinked candidate is its own cluster.
func TestDeriveClusters(t *testing.T) {
	cands := []Neighbor{{MemoryID: "a"}, {MemoryID: "b"}, {MemoryID: "solo"}}
	links := []ClusterLink{
		{AID: "a", BID: "x"}, // a — x (x is a 1-hop connector, not a candidate)
		{AID: "x", BID: "b"}, // x — b ⇒ a and b share a component
	}
	clusterOf := deriveClusters(cands, links)
	if clusterOf["a"] != clusterOf["b"] {
		t.Fatalf("a and b should be in the same cluster (joined via x): %q vs %q", clusterOf["a"], clusterOf["b"])
	}
	if clusterOf["solo"] == clusterOf["a"] {
		t.Fatalf("unlinked candidate should be its own cluster")
	}
}
