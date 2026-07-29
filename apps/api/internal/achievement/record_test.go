package achievement

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

// newRecordService pairs a service with the store its reports are written through. RecordProgress
// never touches the service's own repo — the store arrives as an argument — so the repo is the same
// fake, which keeps a second throwaway out of every test.
func newRecordService(t *testing.T) (*Service, *fakeStore) {
	t.Helper()
	store := newFakeStore()
	return newTestService(t, store), store
}

func TestRecordProgressRefusesWhatCannotBeAFact(t *testing.T) {
	t.Parallel()
	service, store := newRecordService(t)
	ctx := context.Background()
	scope := testScope(t)

	for _, delta := range []int{0, -1} {
		if err := service.RecordProgress(ctx, scope, store, CounterDiaryWritten, delta); !errors.Is(err, ErrProgressDeltaInvalid) {
			t.Fatalf("accumulate delta %d = %v, want ErrProgressDeltaInvalid", delta, err)
		}
	}
	// A reach report of zero is a legitimate observation — a user owning no ornaments yet — and
	// GREATEST(value, 0) lowers nothing. Refusing it would abort the save that reported it.
	if err := service.RecordProgress(ctx, scope, store, CounterOrnamentOwned, 0); err != nil {
		t.Fatalf("reach report of zero = %v, want accepted", err)
	}
	if err := service.RecordProgress(ctx, scope, store, CounterOrnamentOwned, -1); !errors.Is(err, ErrProgressDeltaInvalid) {
		t.Fatalf("negative reach report = %v, want ErrProgressDeltaInvalid", err)
	}
	if err := service.RecordProgress(ctx, scope, store, CounterKey("streak_days"), 1); !errors.Is(err, ErrUnknownCounterKey) {
		t.Fatalf("unknown key = %v, want ErrUnknownCounterKey", err)
	}
	// A producer may not push a counter this context derives: thirteen JOY entries would otherwise
	// read as thirteen moods.
	if err := service.RecordProgress(ctx, scope, store, CounterMoodVariety, 1); !errors.Is(err, ErrDerivedCounterNotReportable) {
		t.Fatalf("derived key = %v, want ErrDerivedCounterNotReportable", err)
	}
	if err := service.RecordProgress(ctx, platform.UserScope{}, store, CounterDiaryWritten, 1); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("unscoped = %v, want ErrScopeRequired", err)
	}
	// Only the accepted reach-zero report above may have touched anything.
	for _, key := range store.touched {
		if key != CounterOrnamentOwned {
			t.Fatalf("a refused report touched %s", key)
		}
	}
}

// The mode is dispatched from the DEFINITION: an accumulate key sums and a reach key keeps the
// high-water mark, whatever the producer happens to pass.
func TestRecordProgressWritesEachKeyInItsDeclaredMode(t *testing.T) {
	t.Parallel()
	service, store := newRecordService(t)
	ctx := context.Background()
	scope := testScope(t)

	for range 3 {
		if err := service.RecordProgress(ctx, scope, store, CounterDiaryWritten, 2); err != nil {
			t.Fatalf("RecordProgress failed: %v", err)
		}
	}
	if store.counters[CounterDiaryWritten] != 6 || store.modes[CounterDiaryWritten] != CounterModeAccumulate {
		t.Fatalf("accumulate key = %d in mode %q", store.counters[CounterDiaryWritten], store.modes[CounterDiaryWritten])
	}

	if err := service.RecordProgress(ctx, scope, store, CounterSemanticStageDepth, 3); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	// A shallower view afterwards lowers nothing — that is the whole point of the reach mode.
	if err := service.RecordProgress(ctx, scope, store, CounterSemanticStageDepth, 1); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	if store.counters[CounterSemanticStageDepth] != 3 || store.modes[CounterSemanticStageDepth] != CounterModeReach {
		t.Fatalf("reach key = %d in mode %q", store.counters[CounterSemanticStageDepth], store.modes[CounterSemanticStageDepth])
	}
}

// The first touch of a family member is what raises the variety counter, so distinctness never needs
// a DISTINCT query and repeating a mood cannot inflate it.
func TestRecordProgressDerivesVarietyFromFirstTouchOnly(t *testing.T) {
	t.Parallel()
	service, store := newRecordService(t)
	ctx := context.Background()
	scope := testScope(t)

	joy, _ := MoodRecordedCounterKey("JOY")
	calm, _ := MoodRecordedCounterKey("CALM")
	for range 4 {
		if err := service.RecordProgress(ctx, scope, store, joy, 1); err != nil {
			t.Fatalf("RecordProgress failed: %v", err)
		}
	}
	if got := store.counters[CounterMoodVariety]; got != 1 {
		t.Fatalf("mood_variety after four JOY entries = %d, want 1", got)
	}
	if err := service.RecordProgress(ctx, scope, store, calm, 1); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	if got := store.counters[CounterMoodVariety]; got != 2 {
		t.Fatalf("mood_variety after a second distinct mood = %d, want 2", got)
	}
	if store.counters[joy] != 4 || store.counters[calm] != 1 {
		t.Fatalf("family members = joy %d calm %d", store.counters[joy], store.counters[calm])
	}
}

// Every catalog row on the counter whose target the new value meets is marked, once. Re-crossing a
// threshold marks nothing new, so achieved_at keeps its first value.
func TestRecordProgressMarksEveryReachedTierOnce(t *testing.T) {
	t.Parallel()
	service, store := newRecordService(t)
	ctx := context.Background()
	scope := testScope(t)

	if err := service.RecordProgress(ctx, scope, store, CounterDiaryWritten, 1); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	if len(store.achievedIDs()) != 1 || store.achievedIDs()[0] != "first_diary" {
		t.Fatalf("after one diary, achieved = %v", store.achievedIDs())
	}
	// Jumping straight past two tiers marks both, because candidates are evaluated by target rather
	// than by arrival order.
	if err := service.RecordProgress(ctx, scope, store, CounterDiaryWritten, 19); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	if len(store.achievedIDs()) != 3 {
		t.Fatalf("after 20 diaries, achieved = %v, want first_diary + diary_5 + diary_20", store.achievedIDs())
	}
	before := len(store.achievedIDs())
	if err := service.RecordProgress(ctx, scope, store, CounterDiaryWritten, 1); err != nil {
		t.Fatalf("RecordProgress failed: %v", err)
	}
	if len(store.achievedIDs()) != before {
		t.Fatalf("re-crossing a threshold marked again: %v", store.achievedIDs())
	}
}

// A store failure propagates, which is what makes the producing transaction roll back rather than
// commit with a silently diverged counter.
func TestRecordProgressPropagatesAStoreFailure(t *testing.T) {
	t.Parallel()
	service, store := newRecordService(t)
	store.failTouchOn = CounterRecallPerformed
	if err := service.RecordProgress(context.Background(), testScope(t), store, CounterRecallPerformed, 1); err == nil {
		t.Fatal("a refused counter write was swallowed")
	}
}

func TestRecordProgressRequiresAStore(t *testing.T) {
	t.Parallel()
	service, _ := newRecordService(t)
	if err := service.RecordProgress(context.Background(), testScope(t), nil, CounterDiaryWritten, 1); !errors.Is(err, ErrRepoRequired) {
		t.Fatalf("nil store = %v, want ErrRepoRequired", err)
	}
}
