package job

import (
	"math"
	"testing"
	"time"
)

func day(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestTemporalBonus(t *testing.T) {
	base := day("2026-06-04")
	cases := []struct {
		name  string
		other time.Time
		want  float64
	}{
		{"same day", day("2026-06-04"), 0.3},
		{"3.5 days", base.Add(-84 * time.Hour), 0.15},
		{"exactly 7 days", day("2026-06-11"), 0.0},
		{"beyond a week", day("2026-07-01"), 0.0},
		{"symmetric (future)", day("2026-06-05"), 0.3 * (1 - 1.0/7.0)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := temporalBonus(base, c.other)
			if math.Abs(got-c.want) > 1e-9 {
				t.Fatalf("temporalBonus = %f, want %f", got, c.want)
			}
		})
	}
}

func TestInitialWeightClamp(t *testing.T) {
	// cos_sim 0.9 + bonus 0.3 = 1.2 → clamped to 1.0
	if got := initialWeight(0.9, 0.3); got != 1.0 {
		t.Fatalf("initialWeight over 1 = %f, want 1.0", got)
	}
	// cos_sim 0.75, no temporal bonus
	if got := initialWeight(0.75, 0.0); math.Abs(got-0.75) > 1e-9 {
		t.Fatalf("initialWeight = %f, want 0.75", got)
	}
	// never negative
	if got := initialWeight(-0.5, 0.0); got != 0.0 {
		t.Fatalf("initialWeight negative = %f, want 0.0", got)
	}
}

func TestBuildLinksExcludesSelfAndComputesWeight(t *testing.T) {
	self := "mmm"
	date := day("2026-06-04")
	neighbors := []Neighbor{
		{MemoryID: "aaa", CosSim: 0.8, EntryDate: date},
		{MemoryID: "zzz", CosSim: 0.9, EntryDate: date},
		{MemoryID: "mmm", CosSim: 1.0, EntryDate: date}, // self → dropped
	}
	links := buildLinks(self, "user-1", date, neighbors)
	if len(links) != 2 {
		t.Fatalf("got %d links, want 2 (self excluded)", len(links))
	}
	for _, l := range links {
		// buildLinks does NOT normalize order — it emits (self, neighbor); the DB
		// normalizes with LEAST/GREATEST. So AID is always self here.
		if l.AID != self {
			t.Fatalf("AID = %q, want self %q", l.AID, self)
		}
		if l.BID != "aaa" && l.BID != "zzz" {
			t.Fatalf("unexpected neighbor BID %q", l.BID)
		}
		if l.UserID != "user-1" {
			t.Fatalf("user_id not carried: %q", l.UserID)
		}
		// Same-day neighbors get cos_sim + 0.3, clamped to 1.0.
		if l.Weight != 1.0 {
			t.Fatalf("same-day high-sim weight = %f, want 1.0", l.Weight)
		}
	}
}

func TestBackoffDelayGrowsAndCaps(t *testing.T) {
	base := 2 * time.Second
	max := 5 * time.Minute
	if d := backoffDelay(1, base, max); d != 2*time.Second { // base·2^0
		t.Fatalf("attempt 1 backoff = %v, want 2s", d)
	}
	if d := backoffDelay(2, base, max); d != 4*time.Second { // base·2^1
		t.Fatalf("attempt 2 backoff = %v, want 4s", d)
	}
	if d := backoffDelay(3, base, max); d != 8*time.Second { // base·2^2
		t.Fatalf("attempt 3 backoff = %v, want 8s", d)
	}
	if d := backoffDelay(100, base, max); d != max { // overflow guard → cap
		t.Fatalf("huge attempt backoff = %v, want cap %v", d, max)
	}
	if d := backoffDelay(20, base, max); d != max { // base·2^19 ≫ 5m → cap
		t.Fatalf("attempt 20 backoff = %v, want cap %v", d, max)
	}
}
