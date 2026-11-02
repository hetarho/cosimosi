package main

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
)

// The boot guards. They live here because the composition root is the one package that sees both
// catalogs and every producer, and they run at wiring time rather than as a test-only assertion — a
// drifted key set must stop the server, not merely fail CI.

func TestAchievementBootGuardsPassForTheShippedWiring(t *testing.T) {
	t.Parallel()
	if err := reconcileAchievementCounterKeys(); err != nil {
		t.Fatalf("the shipped producers and catalog disagree: %v", err)
	}
	if err := reconcileAchievementRewards(); err != nil {
		t.Fatalf("a shipped reward is malformed: %v", err)
	}
}

// The reward guard has teeth on both malformed shapes, driven through the SHIPPED body. A neither-leg
// row is the one that matters most: it pays 0, twinkle refuses a zero grant, and every claimer of it
// would land in the claimed-but-unpaid state deterministically — with the settle drain retrying a leg
// that can never succeed.
func TestAchievementRewardReconciliationRefusesBothMalformedShapes(t *testing.T) {
	t.Parallel()
	for name, reward := range map[string]achievement.Reward{
		"neither leg": {},
		"both legs":   {Tier: achievement.RewardTier1, OrnamentID: "star_shader.spire"},
	} {
		malformed := []achievement.Achievement{{
			ID:        "malformed_row",
			Axis:      achievement.AxisFirstExperience,
			Condition: achievement.Condition{Counter: achievement.CounterDiaryWritten, Target: 1},
			Reward:    reward,
		}}
		err := reconcileRewards(malformed)
		if err == nil {
			t.Fatalf("%s was accepted", name)
		}
		// A boot refusal is read once, in a log, by someone who cannot debug it interactively — it has
		// to name the row.
		if !strings.Contains(err.Error(), "malformed_row") {
			t.Fatalf("%s refusal does not name the row: %v", name, err)
		}
	}
}

// Each direction of the reconciliation has teeth, driven through the SHIPPED body rather than a copy
// of it — the no-op recorder default is what makes such drift silent otherwise, since a renamed key
// keeps passing every test until a real recorder is bound to a real save.
func TestAchievementCounterKeyReconciliationFailsInBothDirections(t *testing.T) {
	t.Parallel()
	shipped := slices.Concat(
		memory.AchievementCounterKeys(),
		store.AchievementCounterKeys(),
		account.AchievementCounterKeys(),
	)

	// A key no condition reads and no family feeds — the shape a renamed constant or a dropped
	// condition leaves behind. The producer would write a counter no achievement can answer for.
	if err := reconcileCounterKeys(append(slices.Clone(shipped), "streak_days")); err == nil {
		t.Fatal("a key nothing reads was accepted")
	} else if !strings.Contains(err.Error(), "streak_days") {
		t.Fatalf("the refusal does not name the offending key: %v", err)
	}

	// The exemption is narrow on purpose: it admits a FAMILY member (read by no condition, but its
	// first touch feeds a variety counter) and nothing else. A blanket "is it in the vocabulary" check
	// would also have admitted the case above.
	familyMember := achievement.MoodRecordedFamily()[0]
	if err := reconcileCounterKeys(append(slices.Clone(shipped), string(familyMember))); err != nil {
		t.Fatalf("the family member %q was refused: %v", familyMember, err)
	}

	// A condition reading a key nobody emits — the unreachable-achievement case.
	if err := reconcileCounterKeys(nil); err == nil {
		t.Fatal("a catalog reading keys no producer emits was accepted")
	}
}

// A recorder handed out before the root finished binding refuses rather than dropping the report —
// the producing transaction fails loudly instead of committing a fact nothing counted. Transactional
// producers report through their own transaction handle, so they have no pool to fall back to.
func TestAchievementRecordersFailClosedUntilBound(t *testing.T) {
	t.Parallel()
	scope, err := platform.NewUserScope("boot-guard-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	account := accountAchievementRecorder{achievementRecorder{binding: &achievementRecorderBinding{}}}
	if err := account.RecordProgress(context.Background(), scope, "invite_settled", 1); !errors.Is(err, errAchievementRecorderUnbound) {
		t.Fatalf("unbound account recorder = %v, want errAchievementRecorderUnbound", err)
	}
	if _, err := bindMemoryTransactions(memorypg.Store{}, nil, nil); !errors.Is(err, errTransactionBindingIncomplete) {
		t.Fatalf("memory binding without its recorder = %v, want errTransactionBindingIncomplete", err)
	}
	if _, err := bindStoreTransactions(storepg.Store{}, nil, nil); !errors.Is(err, errTransactionBindingIncomplete) {
		t.Fatalf("store binding without its recorder = %v, want errTransactionBindingIncomplete", err)
	}
}

// The worker settles no signup, so its account recorder refuses instead of counting nothing: an
// unexpected settlement there should be loud.
func TestWorkerAccountRecorderRefusesRatherThanCountingNothing(t *testing.T) {
	t.Parallel()
	scope, err := platform.NewUserScope("worker-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := (accountAchievementUnavailable{}).RecordProgress(
		context.Background(),
		scope,
		"invite_settled",
		1,
	); !errors.Is(err, errAchievementSignupRecordingUnavailable) {
		t.Fatalf("worker recorder = %v, want errAchievementSignupRecordingUnavailable", err)
	}
}
