package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestRecallAccessibilityDerivesTheSpendTimeWeight(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	// A fresh memory (created at signal time, never recalled) sits at the weight
	// floor; a long-decayed one saturates at the cap — the same [F4] curve the
	// recall spend prices.
	fixture.seedRecallable("fresh", EpisodicMemory{CreatedUniverseTime: fixtureToday(), BaseStrength: 0.5}, nil, nil)
	fixture.seedRecallable("silent", EpisodicMemory{CreatedUniverseTime: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), BaseStrength: 0.5}, nil, nil)

	freshWeight, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), "fresh")
	if err != nil {
		t.Fatalf("RecallAccessibility(fresh) failed: %v", err)
	}
	if freshWeight != float64(values.ForgettingCostWeightFloor) {
		t.Fatalf("fresh weight = %v, want the floor %v", freshWeight, values.ForgettingCostWeightFloor)
	}
	silentWeight, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), "silent")
	if err != nil {
		t.Fatalf("RecallAccessibility(silent) failed: %v", err)
	}
	if silentWeight != float64(values.ForgettingCostWeightCap) {
		t.Fatalf("silent weight = %v, want the cap %v", silentWeight, values.ForgettingCostWeightCap)
	}
	// The signal is the exact weight the recall spend would carry at today's clock.
	if want := recallAccessibilitySignal(recallAnchorOf(fixture.launches.recallStars["silent"]), fixtureToday()); silentWeight != want {
		t.Fatalf("signal = %v, want the spend-time derivation %v", silentWeight, want)
	}
}

func TestRecallAccessibilityRefusesDeletedAndMissingTargets(t *testing.T) {
	t.Parallel()
	deletedAt := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	fixture := newFixture(t)
	fixture.launches.clock = seededTimePtr(recallTestClock())
	fixture.seedRecallable("gone", EpisodicMemory{CreatedUniverseTime: fixtureToday(), DeletedAt: &deletedAt}, nil, nil)

	if _, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), "gone"); !errors.Is(err, ErrRecallMemoryUnavailable) {
		t.Fatalf("deleted err = %v, want ErrRecallMemoryUnavailable", err)
	}
	if _, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), "never"); !errors.Is(err, ErrRecallMemoryNotFound) {
		t.Fatalf("missing err = %v, want ErrRecallMemoryNotFound", err)
	}
	if _, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), ""); !errors.Is(err, ErrSpendSignalInputRequired) {
		t.Fatalf("empty id err = %v, want ErrSpendSignalInputRequired", err)
	}
	if _, err := fixture.service.RecallAccessibility(context.Background(), platform.UserScope{}, "gone"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("scopeless err = %v, want ErrScopeRequired", err)
	}
}

func TestDiaryRecallAccessibilitiesListsPerStarWeights(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.launches.clock = seededTimePtr(recallTestClock())
	fixture.seedRecallable("m1", EpisodicMemory{CreatedUniverseTime: fixtureToday(), BaseStrength: 0.5}, nil, nil)
	fixture.seedRecallable("m2", EpisodicMemory{CreatedUniverseTime: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), BaseStrength: 0.5}, nil, nil)
	fixture.launches.diaryMemories = map[string][]string{"d1": {"m1", "m2"}}

	weights, err := fixture.service.DiaryRecallAccessibilities(context.Background(), testScope(t), "d1")
	if err != nil {
		t.Fatalf("DiaryRecallAccessibilities failed: %v", err)
	}
	if len(weights) != 2 || weights[0] != float64(values.ForgettingCostWeightFloor) || weights[1] != float64(values.ForgettingCostWeightCap) {
		t.Fatalf("weights = %v, want [floor cap] per memory", weights)
	}
	// A diary with nothing live prices as an empty list, mirroring RecallDiaryStars.
	empty, err := fixture.service.DiaryRecallAccessibilities(context.Background(), testScope(t), "unknown")
	if err != nil {
		t.Fatalf("DiaryRecallAccessibilities(unknown) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("weights = %v, want empty for a diary with no live memories", empty)
	}
}

func TestViewableGistStageIsTheRisenBoundedStage(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.launches.clock = seededTimePtr(recallTestClock())
	fixture.seedGist("risen", 3, fourStages())
	fixture.seedGist("unrisen", 0, nil)
	fixture.seedGist("pending", 2, nil)

	stage, err := fixture.service.ViewableGistStage(context.Background(), testScope(t), "risen")
	if err != nil {
		t.Fatalf("ViewableGistStage failed: %v", err)
	}
	if stage != 3 {
		t.Fatalf("stage = %d, want the risen 3", stage)
	}
	for _, id := range []string{"unrisen", "pending"} {
		if _, err := fixture.service.ViewableGistStage(context.Background(), testScope(t), id); !errors.Is(err, ErrViewSemanticStageNotRisen) {
			t.Fatalf("%s err = %v, want ErrViewSemanticStageNotRisen", id, err)
		}
	}
	if _, err := fixture.service.ViewableGistStage(context.Background(), testScope(t), "never"); !errors.Is(err, ErrViewSemanticMemoryNotFound) {
		t.Fatalf("missing err = %v, want ErrViewSemanticMemoryNotFound", err)
	}
}

func TestSignalUniverseTimeNeverPrecedesTheClock(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// A clock ahead of real today (the +1-day launch slack) keeps the signal at the
	// clock — a signal may never derive from before the universe's present ([I10]).
	ahead := fixtureToday().AddDate(0, 0, 1)
	fixture.launches.clock = &ahead
	fixture.seedRecallable("m1", EpisodicMemory{CreatedUniverseTime: ahead, BaseStrength: 0.5}, nil, nil)

	weight, err := fixture.service.RecallAccessibility(context.Background(), testScope(t), "m1")
	if err != nil {
		t.Fatalf("RecallAccessibility failed: %v", err)
	}
	if want := recallAccessibilitySignal(recallAnchorOf(fixture.launches.recallStars["m1"]), ahead); weight != want {
		t.Fatalf("weight = %v, want the clock-anchored %v", weight, want)
	}
}
