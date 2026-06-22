package memory

import (
	"math"
	"testing"
	"time"
)

func TestArousalFromSamplesUsesBjorkRetrievalEnvelope(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	if got := ArousalFromSamples(nil, now); got != 0 {
		t.Fatalf("empty arousal = %f, want 0", got)
	}

	recent := ArousalFromSamples([]ArousalSample{{
		RecallCount:    0,
		Intensity:      0,
		LastRecalledAt: now,
	}}, now)
	stale := ArousalFromSamples([]ArousalSample{{
		RecallCount:    0,
		Intensity:      0,
		LastRecalledAt: now.AddDate(0, 0, -60),
	}}, now)
	consolidated := ArousalFromSamples([]ArousalSample{{
		RecallCount:    8,
		Intensity:      0.8,
		LastRecalledAt: now.AddDate(0, 0, -60),
	}}, now)

	if recent <= stale {
		t.Fatalf("recent arousal %.4f should exceed stale %.4f", recent, stale)
	}
	if consolidated <= stale {
		t.Fatalf("consolidated stale arousal %.4f should exceed weak stale %.4f", consolidated, stale)
	}
	if recent <= 0 || recent >= 1 || math.IsNaN(recent) {
		t.Fatalf("recent arousal %.4f must stay in (0,1)", recent)
	}
}
