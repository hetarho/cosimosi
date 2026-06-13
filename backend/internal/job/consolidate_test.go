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
		Links: []ConsolidateLink{{AID: "A", BID: "B", Weight: 0.8}}, // 2-node cluster < schemaMinCluster
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

// A schema-fit star (cluster ≥ schemaMinCluster AND degree ≥ schemaMinDegree) is pulled
// harder (redistributeLerp + schemaBonus) than a star in a small cluster.
func TestRedistributeSchemaBonus(t *testing.T) {
	coords := map[string]vec3{"A": {30, 0, 0}, "B": {-30, 0, 0}, "C": {0, 0, 0}}
	// Triangle A-B-C: cluster size 3, each degree 2 → schema-fit.
	g := ConsolidateGraph{
		Stars: []ConsolidateStar{{ID: "A"}, {ID: "B"}, {ID: "C"}},
		Links: []ConsolidateLink{
			{AID: "A", BID: "B", Weight: 0.5},
			{AID: "B", BID: "C", Weight: 0.5},
			{AID: "A", BID: "C", Weight: 0.5},
		},
	}
	redistribute(coords, g)
	// centroid = (0,0,0); schema-fit lerp = 0.6+0.15 = 0.75 → A.x: 30 + (0-30)*0.75 = 7.5.
	if math.Abs(coords["A"][0]-7.5) > 1e-9 {
		t.Fatalf("A.x = %f, want 7.5 (lerp 0.75 with schemaBonus)", coords["A"][0])
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
