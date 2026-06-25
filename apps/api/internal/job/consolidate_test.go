package job

import (
	"math"
	"testing"
	"time"
)

func dist3(a, b vec3) float64 {
	dx, dy, dz := a[0]-b[0], a[1]-b[1], a[2]-b[2]
	return math.Sqrt(dx*dx + dy*dy + dz*dz)
}

func ptr(f float64) *float64 { return &f }

// consolidateClusters groups stars into connected components over their synapses.
func TestConsolidateClustersConnectedComponents(t *testing.T) {
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{{ID: "A"}, {ID: "B"}, {ID: "C"}, {ID: "D"}},
		Links: []ConsolidateLink{
			{AID: "A", BID: "B", Weight: 0.8},
			{AID: "B", BID: "C", Weight: 0.5},
			// D isolated
		},
	}
	cl := consolidateClusters(g)
	if cl["A"] != cl["B"] || cl["B"] != cl["C"] {
		t.Fatalf("A,B,C should share a cluster: %v", cl)
	}
	if cl["D"] == cl["A"] {
		t.Fatalf("isolated D must be its own cluster: %v", cl)
	}
	if cl["D"] != "D" {
		t.Fatalf("singleton root should be itself, got %q", cl["D"])
	}
}

// redistribute pulls each star toward its host cluster's centroid by redistributeLerp;
// a singleton sits at its own centroid (no move).
func TestRedistributePullsTowardCentroid(t *testing.T) {
	coords := map[string]vec3{
		"A": {10, 0, 0},
		"B": {-10, 0, 0},
		"S": {50, 50, 50}, // singleton
	}
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{{ID: "A"}, {ID: "B"}, {ID: "S"}},
		Links: []ConsolidateLink{{AID: "A", BID: "B", Weight: 0.8}}, // A,B one cluster; S a singleton
	}
	redistribute(coords, g)
	// centroid of {A,B} = origin; lerp 0.6 → A moves from 10 to 10+(0-10)*0.6 = 4.
	if math.Abs(coords["A"][0]-4) > 1e-9 {
		t.Fatalf("A.x = %f, want 4 (lerp 0.6 toward centroid)", coords["A"][0])
	}
	if math.Abs(coords["B"][0]+4) > 1e-9 {
		t.Fatalf("B.x = %f, want -4", coords["B"][0])
	}
	// Singleton's centroid is itself → unmoved.
	if dist3(coords["S"], vec3{50, 50, 50}) > 1e-9 {
		t.Fatalf("singleton moved: %v", coords["S"])
	}
}

// stageForRadius counts how many ascending thresholds a radius exceeds (0..len) — the
// abstraction stage a star's distance maps to (spec 27 change 20).
func TestStageForRadius(t *testing.T) {
	th := []float64{40, 55, 68, 78}
	cases := []struct {
		r    float64
		want int
	}{{10, 0}, {40, 0}, {41, 1}, {60, 2}, {70, 3}, {78, 3}, {79, 4}, {200, 4}}
	for _, c := range cases {
		if got := stageForRadius(c.r, th); got != c.want {
			t.Errorf("stageForRadius(%g) = %d, want %d", c.r, got, c.want)
		}
	}
}

// Two stars identical except connectivity: the well-connected one (links extend τ → slower
// decay → higher R) sits at a SMALLER radius. Connectivity only pulls inward (change 18).
func TestStarRadiiConnectivityPullsInward(t *testing.T) {
	old := time.Now().UTC().Add(-40 * 24 * time.Hour) // far enough out that R is well below 1
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{
			{ID: "hub", LastRecalledAt: old, RecallCount: 1},
			{ID: "iso", LastRecalledAt: old, RecallCount: 1},
			{ID: "n1", LastRecalledAt: old, RecallCount: 1},
			{ID: "n2", LastRecalledAt: old, RecallCount: 1},
		},
		Links: []ConsolidateLink{
			{AID: "hub", BID: "n1", Weight: 0.8},
			{AID: "hub", BID: "n2", Weight: 0.8},
		},
	}
	radii := starRadii(g, float64(time.Now().UTC().Unix())/86400.0)
	if radii["hub"] >= radii["iso"] {
		t.Fatalf("connected hub radius %f should be < isolated radius %f", radii["hub"], radii["iso"])
	}
	// Connectivity never pushes a star past R_MIN inward nor outside R_MAX.
	for id, r := range radii {
		if r < 6 || r > 80 {
			t.Fatalf("%s radius %f out of [R_MIN 6, R_MAX 80]", id, r)
		}
	}
}

// scopeSubgraph keeps only stars within the radius scope (+ links between them) — far-drifted
// stars are excluded from the re-stabilize/redistribute passes (acceptance A2).
func TestScopeSubgraphExcludesFarStars(t *testing.T) {
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{{ID: "near"}, {ID: "mid"}, {ID: "far"}},
		Links: []ConsolidateLink{{AID: "near", BID: "mid", Weight: 0.5}, {AID: "mid", BID: "far", Weight: 0.5}},
	}
	radii := map[string]float64{"near": 10, "mid": 50, "far": 75}
	sub := scopeSubgraph(g, radii, 60)
	if len(sub.Stars) != 2 {
		t.Fatalf("want 2 in-scope stars (near,mid), got %d", len(sub.Stars))
	}
	// The near-mid link is kept (both in scope); mid-far is dropped (far is out).
	if len(sub.Links) != 1 || sub.Links[0].AID != "near" {
		t.Fatalf("want only the near-mid link in scope, got %+v", sub.Links)
	}
}

// spread fans clusters out deterministically: same input → same output, and two coincident
// singleton clusters get distinct offsets (no collapse to one point — acceptance A4).
func TestSpreadClustersDeterministicAndSeparating(t *testing.T) {
	mk := func() (map[string]vec3, ConsolidateGraph) {
		coords := map[string]vec3{"A": {0, 0, 0}, "B": {0, 0, 0}}
		g := ConsolidateGraph{Stars: []ConsolidateStar{{ID: "A"}, {ID: "B"}}} // no links → two singleton clusters
		return coords, g
	}
	c1, g1 := mk()
	c2, g2 := mk()
	spreadClusters(c1, g1)
	spreadClusters(c2, g2)
	for _, id := range []string{"A", "B"} {
		if dist3(c1[id], c2[id]) > 1e-12 {
			t.Fatalf("spread not deterministic for %s: %v vs %v", id, c1[id], c2[id])
		}
	}
	// The two singletons started coincident; distinct hash directions must separate them.
	if dist3(c1["A"], c1["B"]) < 1e-6 {
		t.Fatalf("spread left clusters coincident: A=%v B=%v", c1["A"], c1["B"])
	}
}

// A multi-star cluster's spread offset must NOT depend on link iteration order — the offset is
// keyed on the cluster's min member id, not the union-find root (whose identity is order-dependent).
func TestSpreadClustersOrderIndependent(t *testing.T) {
	stars := []ConsolidateStar{{ID: "a"}, {ID: "b"}, {ID: "c"}}
	// Same triangle cluster, links in two different orders (union-find may pick a different root).
	g1 := ConsolidateGraph{Stars: stars, Links: []ConsolidateLink{
		{AID: "a", BID: "b", Weight: 0.5}, {AID: "b", BID: "c", Weight: 0.5}}}
	g2 := ConsolidateGraph{Stars: stars, Links: []ConsolidateLink{
		{AID: "b", BID: "c", Weight: 0.5}, {AID: "a", BID: "b", Weight: 0.5}}}
	c1 := map[string]vec3{"a": {0, 0, 0}, "b": {0, 0, 0}, "c": {0, 0, 0}}
	c2 := map[string]vec3{"a": {0, 0, 0}, "b": {0, 0, 0}, "c": {0, 0, 0}}
	spreadClusters(c1, g1)
	spreadClusters(c2, g2)
	for _, id := range []string{"a", "b", "c"} {
		if dist3(c1[id], c2[id]) > 1e-12 {
			t.Fatalf("spread differs by link order for %s: %v vs %v", id, c1[id], c2[id])
		}
	}
}

// spreadDirection is a deterministic unit vector from the cluster's canonical key.
func TestSpreadDirectionUnit(t *testing.T) {
	d := spreadDirection("some-root-id")
	r := math.Sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2])
	if math.Abs(r-1) > 1e-9 {
		t.Fatalf("spreadDirection not unit length: |d| = %f", r)
	}
	if dist3(spreadDirection("x"), spreadDirection("x")) != 0 {
		t.Fatal("spreadDirection not deterministic")
	}
}

// The server force layout converges: a single linked pair settles near linkDistance,
// and the same input yields the same output (deterministic — no RNG, no clock).
func TestConsolidateLayoutConvergesAndDeterministic(t *testing.T) {
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{{ID: "A"}, {ID: "B"}},
		Links: []ConsolidateLink{{AID: "A", BID: "B", Weight: 1.0}},
	}
	c1 := consolidateLayout(g)
	c2 := consolidateLayout(g)
	for _, id := range []string{"A", "B"} {
		if dist3(c1[id], c2[id]) > 1e-12 {
			t.Fatalf("layout not deterministic for %s: %v vs %v", id, c1[id], c2[id])
		}
		for _, v := range c1[id] {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				t.Fatalf("non-finite coordinate for %s: %v", id, c1[id])
			}
		}
	}
	d := dist3(c1["A"], c1["B"])
	if d < 15 || d > 45 {
		t.Fatalf("linked pair settled at %f, want ≈ linkDistance %g (15..45)", d, float64(layoutLinkDistance))
	}
}

// A star with a cached stable coordinate resumes from it (re-entry acceleration);
// a star without one seeds on the fibonacci shell. Both end finite.
func TestConsolidateLayoutSeedsFromStableOrShell(t *testing.T) {
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{
			{ID: "cached", StableX: ptr(5), StableY: ptr(6), StableZ: ptr(7)},
			{ID: "cold"}, // nil stable coords → fibonacci seed
		},
	}
	out := consolidateLayout(g)
	if _, ok := out["cached"]; !ok {
		t.Fatal("cached star missing from layout")
	}
	if _, ok := out["cold"]; !ok {
		t.Fatal("cold star missing from layout")
	}
}

func TestFibonacciSeedOnShell(t *testing.T) {
	const n = 20
	for i := 0; i < n; i++ {
		p := fibonacciSeed(i, n)
		r := math.Sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2])
		if math.Abs(r-layoutSeedRadius) > 1e-6 {
			t.Fatalf("seed %d radius = %f, want %g", i, r, float64(layoutSeedRadius))
		}
	}
	// Deterministic: same index → same point.
	if dist3(fibonacciSeed(3, n), fibonacciSeed(3, n)) != 0 {
		t.Fatal("fibonacciSeed not deterministic")
	}
}

func TestDurationUntilHour(t *testing.T) {
	mk := func(h, m int) time.Time { return time.Date(2026, 6, 14, h, m, 0, 0, time.UTC) }
	// Before the hour today → later today.
	if d := durationUntilHour(mk(10, 0), 18); d != 8*time.Hour {
		t.Fatalf("10:00→18:00 = %v, want 8h", d)
	}
	// After the hour → tomorrow.
	if d := durationUntilHour(mk(20, 0), 18); d != 22*time.Hour {
		t.Fatalf("20:00→18:00(next) = %v, want 22h", d)
	}
	// Exactly the hour → not "after", so tomorrow (full 24h) — never fires twice instantly.
	if d := durationUntilHour(mk(18, 0), 18); d != 24*time.Hour {
		t.Fatalf("18:00→18:00 = %v, want 24h", d)
	}
}
