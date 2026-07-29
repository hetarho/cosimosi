package achievement

import "testing"

func TestCounterVocabularyIsClosed(t *testing.T) {
	t.Parallel()
	if KnownCounterKey("consecutive_login_days") {
		t.Fatal("a key outside the closed set is a member")
	}
	if _, ok := CounterModeOf("diary_written_today"); ok {
		t.Fatal("an unknown key resolved a mode")
	}
	for key, want := range map[CounterKey]CounterMode{
		CounterDiaryWritten:        CounterModeAccumulate,
		CounterSemanticStageDepth:  CounterModeReach,
		CounterNeuronShareDepth:    CounterModeReach,
		CounterOrnamentOwned:       CounterModeReach,
		CounterMoodVariety:         CounterModeAccumulate,
		CounterOrnamentKindVariety: CounterModeAccumulate,
	} {
		mode, ok := CounterModeOf(key)
		if !ok || mode != want {
			t.Fatalf("CounterModeOf(%q) = %q %v, want %q", key, mode, ok, want)
		}
	}
}

// Every key in the closed set earns its place: it is either read by a catalog condition or a family
// member whose first touch feeds a variety counter. An orphan key would be a producer pushing into
// nothing — countable, but unreachable by any achievement.
//
// The converse is deliberately NOT one-axis-per-key: a "first experience" row and a totals row
// legitimately share one counter (diary_written is read at target 1 and at 5/20/50/200), which is
// the catalog's own shape.
func TestEveryClosedSetKeyIsReachable(t *testing.T) {
	t.Parallel()
	read := map[CounterKey]struct{}{}
	for _, row := range Catalog() {
		read[row.Condition.Counter] = struct{}{}
	}
	for key := range counterModes {
		if _, isRead := read[key]; isRead {
			continue
		}
		if _, feedsVariety := VarietyCounterFor(key); feedsVariety {
			continue
		}
		t.Errorf("counter %q is in the closed set but no condition reads it and it feeds no variety counter", key)
	}
}

func TestFamilyKeysAreClosedAndFeedTheirVarietyCounter(t *testing.T) {
	t.Parallel()
	if got := len(MoodRecordedFamily()); got != 13 {
		t.Fatalf("mood family length = %d, want 13 ([M2])", got)
	}
	if _, ok := MoodRecordedCounterKey("NOSTALGIA"); ok {
		t.Fatal("a fourteenth mood key was minted")
	}
	if _, ok := OrnamentKindDecoratedCounterKey("PALETTE"); ok {
		t.Fatal("the retired PALETTE kind minted a key (change 08)")
	}
	joy, ok := MoodRecordedCounterKey("JOY")
	if !ok || joy != CounterKey("mood_recorded:JOY") {
		t.Fatalf("MoodRecordedCounterKey(JOY) = %q %v", joy, ok)
	}
	for _, member := range MoodRecordedFamily() {
		variety, ok := VarietyCounterFor(member)
		if !ok || variety != CounterMoodVariety {
			t.Fatalf("VarietyCounterFor(%q) = %q %v", member, variety, ok)
		}
		if !KnownCounterKey(member) {
			t.Fatalf("family member %q is not in the closed set", member)
		}
	}
	for _, member := range OrnamentKindDecoratedFamily() {
		variety, ok := VarietyCounterFor(member)
		if !ok || variety != CounterOrnamentKindVariety {
			t.Fatalf("VarietyCounterFor(%q) = %q %v", member, variety, ok)
		}
	}
	if _, ok := VarietyCounterFor(CounterDiaryWritten); ok {
		t.Fatal("a non-family key feeds a variety counter")
	}
}

// The two variety counters are this context's own to maintain: a producer that pushed one directly
// would be counting distinctness it cannot prove.
func TestDerivedCounterKeysAreNamed(t *testing.T) {
	t.Parallel()
	for _, key := range []CounterKey{CounterMoodVariety, CounterOrnamentKindVariety} {
		if !DerivedCounterKey(key) {
			t.Fatalf("%q is maintained here but not reported as derived", key)
		}
	}
	for _, key := range []CounterKey{CounterDiaryWritten, CounterNeuronShareDepth} {
		if DerivedCounterKey(key) {
			t.Fatalf("%q is producer-pushed but reported as derived", key)
		}
	}
	for _, key := range MoodRecordedFamily() {
		if DerivedCounterKey(key) {
			t.Fatalf("family member %q is producer-pushed but reported as derived", key)
		}
	}
}
