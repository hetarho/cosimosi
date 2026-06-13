package memory

import (
	"math"
	"testing"
	"time"
)

// sample is a tiny helper: an emotion that was last active `daysAgo` before `now`.
func sample(now time.Time, mood Mood, intensity, valence, daysAgo float64) EmotionSample {
	return EmotionSample{
		Mood:           mood,
		Intensity:      intensity,
		Valence:        valence,
		LastRecalledAt: now.Add(-time.Duration(daysAgo * 24 * float64(time.Hour))),
	}
}

// 1.4: an empty window returns the neutral AmbientMood{} and ExcitabilityGain 1.0 — the
// allocation bias is unchanged and nothing crashes on a brand-new (star-0) universe.
func TestAggregateAmbientEmptyIsNeutral(t *testing.T) {
	now := time.Now().UTC()
	got := AggregateAmbient(nil, now)
	if got != (AmbientMood{}) {
		t.Fatalf("empty aggregate = %+v, want neutral zero value", got)
	}
	// All-zero-intensity samples contribute zero weight → still neutral.
	zero := AggregateAmbient([]EmotionSample{sample(now, MoodJoy, 0, 0.8, 0)}, now)
	if zero != (AmbientMood{}) {
		t.Fatalf("zero-weight aggregate = %+v, want neutral zero value", zero)
	}
	if g := ExcitabilityGain(got); g != 1.0 {
		t.Fatalf("ExcitabilityGain(neutral) = %v, want 1.0", g)
	}
}

// 1.2: a turbulent recent self (many strong anger/fear) reads as higher arousal and a
// negative valence; a calm recent self (weak calm) as lower arousal and positive valence.
func TestAggregateAmbientTurbulentVsCalm(t *testing.T) {
	now := time.Now().UTC()
	turbulent := AggregateAmbient([]EmotionSample{
		sample(now, MoodAnger, 0.85, -0.7, 1),
		sample(now, MoodFear, 0.8, -0.6, 2),
		sample(now, MoodAnger, 0.9, -0.65, 0),
	}, now)
	calm := AggregateAmbient([]EmotionSample{
		sample(now, MoodCalm, 0.3, 0.5, 1),
		sample(now, MoodCalm, 0.25, 0.45, 2),
		sample(now, MoodCalm, 0.35, 0.55, 0),
	}, now)

	if !(turbulent.Arousal > calm.Arousal) {
		t.Fatalf("turbulent arousal %v should exceed calm %v", turbulent.Arousal, calm.Arousal)
	}
	if !(turbulent.Valence < 0) {
		t.Fatalf("turbulent valence %v should be negative", turbulent.Valence)
	}
	if !(calm.Valence > 0) {
		t.Fatalf("calm valence %v should be positive", calm.Valence)
	}
	if turbulent.Hue == calm.Hue {
		t.Fatalf("turbulent and calm should yield different hues (got %v both)", turbulent.Hue)
	}
}

// 1.3: the same event contributes monotonically less as it recedes (exp envelope), and a
// sample far past the 7-day window weighs negligibly (slow envelope).
func TestAggregateAmbientDecayMonotone(t *testing.T) {
	now := time.Now().UTC()
	var prev float64 = math.Inf(1)
	for _, daysAgo := range []float64{0, 1, 3, 7, 14} {
		a := AggregateAmbient([]EmotionSample{sample(now, MoodJoy, 0.8, 0.6, daysAgo)}, now)
		if a.Arousal >= prev {
			t.Fatalf("arousal did not decrease at %v days (%v >= %v)", daysAgo, a.Arousal, prev)
		}
		prev = a.Arousal
	}
	// 21 days out (3·τ) the contribution is effectively gone.
	far := AggregateAmbient([]EmotionSample{sample(now, MoodJoy, 0.8, 0.6, 21)}, now)
	if far.Arousal > 0.05 {
		t.Fatalf("21-day-old sample still arousal %v, want negligible (<0.05)", far.Arousal)
	}
}

// 1.5: ExcitabilityGain maps arousal∈[0,1] onto [1,1.3] (= 1 + 0.3·arousal), monotonically.
func TestExcitabilityGainRange(t *testing.T) {
	for _, ar := range []float64{0, 0.25, 0.5, 0.75, 1} {
		g := ExcitabilityGain(AmbientMood{Arousal: ar})
		if g < 1 || g > 1.3 {
			t.Fatalf("gain(%v) = %v, want within [1,1.3]", ar, g)
		}
		if want := 1 + 0.3*ar; math.Abs(g-want) > 1e-9 {
			t.Fatalf("gain(%v) = %v, want %v", ar, g, want)
		}
	}
	// And real aggregates stay in range: turbulent input never exceeds 1.3.
	now := time.Now().UTC()
	a := AggregateAmbient([]EmotionSample{
		sample(now, MoodAnger, 1, -0.8, 0),
		sample(now, MoodFear, 1, -0.7, 0),
		sample(now, MoodStress, 1, -0.6, 0),
	}, now)
	if g := ExcitabilityGain(a); g < 1 || g >= 1.3 {
		t.Fatalf("gain of saturated aggregate = %v, want [1,1.3)", g)
	}
}

// valence is the time-weighted mean, dominated by the nearest/strongest samples.
func TestAggregateAmbientValenceMean(t *testing.T) {
	now := time.Now().UTC()
	// A strong, recent positive sample outweighs a faint, old negative one → net positive.
	a := AggregateAmbient([]EmotionSample{
		sample(now, MoodJoy, 0.9, 0.8, 0),
		sample(now, MoodSad, 0.2, -0.6, 6),
	}, now)
	if a.Valence <= 0 {
		t.Fatalf("weighted valence = %v, want positive (recent strong joy dominates)", a.Valence)
	}
	if a.Valence > 0.8 {
		t.Fatalf("weighted valence = %v, must not exceed the strongest sample's 0.8", a.Valence)
	}
}
