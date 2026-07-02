package memory

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

func TestMoodEnumMatchesGeneratedCoordinateMaps(t *testing.T) {
	t.Parallel()

	moods := AllMoods()
	if len(moods) != 13 {
		t.Fatalf("AllMoods length = %d, want 13", len(moods))
	}

	keys := make(map[string]Mood, len(moods))
	seen := make(map[Mood]bool, len(moods))
	for _, mood := range moods {
		if seen[mood] {
			t.Fatalf("duplicate mood %q", mood)
		}
		seen[mood] = true
		key, ok := moodValueKey(mood)
		if !ok {
			t.Fatalf("mood %q has no values.yaml key", mood)
		}
		keys[key] = mood
	}

	assertExactMoodKeys(t, "emotion.mood_valence", values.EmotionMoodValence, keys)
	assertExactMoodKeys(t, "emotion.mood_arousal", values.EmotionMoodArousal, keys)
}

func TestMoodCoordinatesMatchQuadrants(t *testing.T) {
	t.Parallel()

	for _, mood := range AllMoods() {
		coordinate, ok := MoodCoordinate(mood)
		if !ok {
			t.Fatalf("MoodCoordinate(%q) failed", mood)
		}
		quadrant, ok := MoodQuadrant(mood)
		if !ok {
			t.Fatalf("MoodQuadrant(%q) failed", mood)
		}

		switch quadrant {
		case EmotionQuadrantPositiveHighArousal:
			assertPositive(t, mood, "valence", coordinate.Valence)
			assertHighArousal(t, mood, coordinate.Arousal)
		case EmotionQuadrantPositiveLowArousal:
			assertPositive(t, mood, "valence", coordinate.Valence)
			assertLowArousal(t, mood, coordinate.Arousal)
		case EmotionQuadrantNegativeHighArousal:
			assertNegative(t, mood, "valence", coordinate.Valence)
			assertHighArousal(t, mood, coordinate.Arousal)
		case EmotionQuadrantNegativeLowArousal:
			assertNegative(t, mood, "valence", coordinate.Valence)
			assertLowArousal(t, mood, coordinate.Arousal)
		case EmotionQuadrantNeutral:
			if coordinate.Valence != 0 {
				t.Fatalf("%s neutral valence = %v, want 0", mood, coordinate.Valence)
			}
			if coordinate.Arousal < 0 || coordinate.Arousal > 1 {
				t.Fatalf("%s neutral arousal = %v, want 0..1", mood, coordinate.Arousal)
			}
		default:
			t.Fatalf("unknown quadrant %q for %s", quadrant, mood)
		}
	}
}

func TestNewEmotionUsesMoodCoordinateAndDefaultIntensity(t *testing.T) {
	t.Parallel()

	emotion, ok := NewEmotion(MoodRelief)
	if !ok {
		t.Fatal("NewEmotion(MoodRelief) failed")
	}
	coordinate, ok := MoodCoordinate(MoodRelief)
	if !ok {
		t.Fatal("MoodCoordinate(MoodRelief) failed")
	}

	if emotion.Mood != MoodRelief || emotion.Valence != coordinate.Valence || emotion.Arousal != coordinate.Arousal {
		t.Fatalf("NewEmotion = %+v, want coordinate %+v", emotion, coordinate)
	}
	if emotion.Intensity != values.EmotionDefaultIntensity {
		t.Fatalf("default intensity = %v, want %v", emotion.Intensity, values.EmotionDefaultIntensity)
	}
}

func TestArousalToInitialStrengthMatchesGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readStrengthFixture(t)
	if !near(fixture.Bounds.Min, values.EmotionArousalStrengthMin) || !near(fixture.Bounds.Max, values.EmotionArousalStrengthMax) {
		t.Fatalf("fixture bounds = %+v, want [%v, %v]", fixture.Bounds, values.EmotionArousalStrengthMin, values.EmotionArousalStrengthMax)
	}

	for _, tc := range fixture.Cases {
		got := ArousalToInitialStrength(tc.Arousal)
		if !near(got, tc.BaseStrength) {
			t.Fatalf("ArousalToInitialStrength(%v) = %v, want %v", tc.Arousal, got, tc.BaseStrength)
		}
	}
	if got := ArousalToInitialStrength(-1); !near(got, values.EmotionArousalStrengthMin) {
		t.Fatalf("low clamp = %v, want %v", got, values.EmotionArousalStrengthMin)
	}
	if got := ArousalToInitialStrength(2); !near(got, values.EmotionArousalStrengthMax) {
		t.Fatalf("high clamp = %v, want %v", got, values.EmotionArousalStrengthMax)
	}
}

type strengthFixture struct {
	Bounds struct {
		Min float64 `json:"min"`
		Max float64 `json:"max"`
	} `json:"bounds"`
	Cases []strengthFixtureCase `json:"cases"`
}

type strengthFixtureCase struct {
	Arousal      float64 `json:"arousal"`
	BaseStrength float64 `json:"base_strength"`
}

func readStrengthFixture(t *testing.T) strengthFixture {
	t.Helper()

	data, err := os.ReadFile("testdata/arousal-strength.golden.json")
	if err != nil {
		t.Fatalf("read strength fixture: %v", err)
	}
	var fixture strengthFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode strength fixture: %v", err)
	}
	return fixture
}

func assertExactMoodKeys(t *testing.T, name string, got map[string]float64, want map[string]Mood) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("%s key count = %d, want %d", name, len(got), len(want))
	}
	for key := range want {
		if _, ok := got[key]; !ok {
			t.Fatalf("%s is missing %q", name, key)
		}
	}
	for key := range got {
		if _, ok := want[key]; !ok {
			t.Fatalf("%s has unknown key %q", name, key)
		}
	}
}

func assertPositive(t *testing.T, mood Mood, axis string, value float64) {
	t.Helper()

	if value <= 0 {
		t.Fatalf("%s %s = %v, want positive", mood, axis, value)
	}
}

func assertNegative(t *testing.T, mood Mood, axis string, value float64) {
	t.Helper()

	if value >= 0 {
		t.Fatalf("%s %s = %v, want negative", mood, axis, value)
	}
}

func assertHighArousal(t *testing.T, mood Mood, value float64) {
	t.Helper()

	if value <= 0.5 {
		t.Fatalf("%s arousal = %v, want high arousal", mood, value)
	}
}

func assertLowArousal(t *testing.T, mood Mood, value float64) {
	t.Helper()

	if value >= 0.5 {
		t.Fatalf("%s arousal = %v, want low arousal", mood, value)
	}
}

func near(got, want float64) bool {
	const tolerance = 0.000000001
	if got < want {
		return want-got <= tolerance
	}
	return got-want <= tolerance
}
