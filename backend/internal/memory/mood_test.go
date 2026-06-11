package memory

import (
	"testing"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
)

// allMoods is the canonical 13 (spec 29): 4 affective quadrants ×3 + neutral.
var allMoods = []Mood{
	MoodJoy, MoodCalm, MoodSad, MoodAnger, MoodFear, MoodLove, MoodNeutral,
	MoodExcitement, MoodGratitude, MoodRelief, MoodStress, MoodTired, MoodEmptiness,
}

// 1.2 — every domain mood round-trips losslessly through the proto enum.
func TestMoodProtoRoundTrip(t *testing.T) {
	for _, m := range allMoods {
		if got := moodFromProto(moodToProto(m)); got != m {
			t.Errorf("round trip %q → %v → %q (want %q)", m, moodToProto(m), got, m)
		}
	}
}

// 1.1/1.2 — all 13 map to distinct, non-UNSPECIFIED proto values.
func TestMoodProtoDistinctAndComplete(t *testing.T) {
	seen := map[cosimosiv1.Mood]bool{}
	for _, m := range allMoods {
		p := moodToProto(m)
		if p == cosimosiv1.Mood_MOOD_UNSPECIFIED {
			t.Errorf("mood %q maps to UNSPECIFIED", m)
		}
		if seen[p] {
			t.Errorf("mood %q maps to a duplicate proto value %v", m, p)
		}
		seen[p] = true
	}
	if want := len(cosimosiv1.Mood_name) - 1; len(seen) != want { // -1 = UNSPECIFIED
		t.Errorf("expected %d distinct proto moods, got %d", want, len(seen))
	}
}

// Every proto Mood value (except UNSPECIFIED) maps to a domain mood and back —
// derived from the generated Mood_name so a future enum value can't be added
// without a real mapping here. The proto-driven half of the parity guard (AC 1.7);
// the hardcoded allMoods above only covers the domain→proto direction.
func TestEveryProtoMoodRoundTrips(t *testing.T) {
	for num, name := range cosimosiv1.Mood_name {
		if num == int32(cosimosiv1.Mood_MOOD_UNSPECIFIED) {
			continue
		}
		p := cosimosiv1.Mood(num)
		d := moodFromProto(p)
		if d == MoodUnspecified {
			t.Errorf("proto Mood %s (%d) has no domain mapping", name, num)
			continue
		}
		if back := moodToProto(d); back != p {
			t.Errorf("proto %s → domain %q → proto %v (not a round-trip)", name, d, back)
		}
	}
}

// Backward-compat (1.4): the original 7 keep their frozen proto numbers.
func TestMoodLegacyProtoNumbersFrozen(t *testing.T) {
	want := map[Mood]cosimosiv1.Mood{
		MoodJoy:     cosimosiv1.Mood_JOY,
		MoodCalm:    cosimosiv1.Mood_CALM,
		MoodSad:     cosimosiv1.Mood_SAD,
		MoodAnger:   cosimosiv1.Mood_ANGER,
		MoodFear:    cosimosiv1.Mood_FEAR,
		MoodLove:    cosimosiv1.Mood_LOVE,
		MoodNeutral: cosimosiv1.Mood_NEUTRAL,
	}
	for m, p := range want {
		if got := moodToProto(m); got != p {
			t.Errorf("legacy mood %q proto changed: got %v want %v", m, got, p)
		}
	}
}

// 1.2 — UNSPECIFIED and out-of-range proto values fall back to the empty mood.
func TestMoodFromProtoUnknownFallsBack(t *testing.T) {
	if got := moodFromProto(cosimosiv1.Mood_MOOD_UNSPECIFIED); got != MoodUnspecified {
		t.Errorf("UNSPECIFIED → %q, want empty", got)
	}
	if got := moodFromProto(cosimosiv1.Mood(999)); got != MoodUnspecified {
		t.Errorf("unknown proto value → %q, want empty", got)
	}
}
