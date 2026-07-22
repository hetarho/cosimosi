package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Paid-action idempotency + consent (job 70, A1–A5). These exercise the receipt replay, the
// same-id/different-input conflict, the server-authoritative consent gate, the sync-status read,
// and the "a rolled-back attempt writes no receipt" guarantee — all over the fake store.

func recallableMemory() EpisodicMemory {
	return EpisodicMemory{CurrentText: "old", Seed: seededSeed(7), RecallCount: 0, BaseStrength: 0.4, SemanticStage: 2, SemanticStages: &SemanticStages{"g1", "g2", "g3", "g4"}, Emotion: Emotion{Mood: MoodJoy}}
}

func TestRecallReplaysCommittedReceiptWithoutRedoingWork(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.predictionError.differs = true
	fixture.seeds = []int64{999}
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)
	fixture.launches.recallMemberNeurons["m1"] = []ExistingNeuron{{ID: "a", Name: "market", Type: NeuronTypeSpatial}}

	first, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "a different memory", true)
	if err != nil {
		t.Fatalf("first recall failed: %v", err)
	}
	if !first.Reconsolidated || first.CurrentText != "a different memory" || first.Seed != 999 {
		t.Fatalf("first result = %+v, want reconsolidated new text + seed 999", first)
	}

	// Replay: same operation id + same input replays the committed result verbatim — no second
	// compare, no second spend, no second provenance row (A2/A3).
	second, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "a different memory", true)
	if err != nil {
		t.Fatalf("replay recall failed: %v", err)
	}
	if second.Reconsolidated != first.Reconsolidated || second.CurrentText != first.CurrentText || second.Seed != first.Seed ||
		second.RecallCount != first.RecallCount || second.EffectiveStrength != first.EffectiveStrength {
		t.Fatalf("replay result = %+v, want the committed first result %+v", second, first)
	}
	if second.Sync.Current.IsZero() || !second.Sync.Current.Equal(first.Sync.Current) {
		t.Fatalf("replay sync = %+v, want the committed first sync %+v", second.Sync, first.Sync)
	}
	if fixture.predictionError.calls != 1 {
		t.Fatalf("compare calls = %d, want 1 (the replay does no work)", fixture.predictionError.calls)
	}
	if len(fixture.spendGate.intents) != 1 {
		t.Fatalf("spend intents = %d, want 1 (the replay does not re-spend)", len(fixture.spendGate.intents))
	}
	// The fake records only the last committed transaction's writes; the replay's transaction
	// stages nothing, so it appends no provenance — the replay does no work.
	if len(fixture.launches.recall.provenance) != 0 {
		t.Fatalf("provenance rows on the replay tx = %d, want 0 (the replay appends none)", len(fixture.launches.recall.provenance))
	}
	if fixture.launches.recallTxCount != 2 {
		t.Fatalf("recall transactions = %d, want 2 (both opened; the second replays inside its tx)", fixture.launches.recallTxCount)
	}
}

func TestRecallSameOperationDifferentInputConflicts(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)
	fixture.launches.recallMemberNeurons["m1"] = []ExistingNeuron{{ID: "a", Name: "market", Type: NeuronTypeSpatial}}

	if _, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "first text", true); err != nil {
		t.Fatalf("first recall failed: %v", err)
	}
	// The same operation id with a different rewrite is a conflict (A2), never a hit that would
	// return the wrong committed result.
	if _, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "different text", true); !errors.Is(err, ErrOperationConflict) {
		t.Fatalf("mismatched-input replay err = %v, want ErrOperationConflict", err)
	}
}

func TestRecallRefusesUnconsentedSyncBeforeSpend(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock() // behind today → a sync would advance the clock
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)

	_, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "reworded", false)
	if !errors.Is(err, ErrSyncConsentRequired) {
		t.Fatalf("unconsented recall err = %v, want ErrSyncConsentRequired", err)
	}
	// Refused before any spend/effect (A5): nothing charged, clock unmoved, no receipt.
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 on an unconsented refusal", len(fixture.spendGate.intents))
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(previous) {
		t.Fatalf("clock = %v, want unmoved on refusal", fixture.launches.clock)
	}
	if len(fixture.launches.receipts) != 0 {
		t.Fatalf("receipts = %d, want 0 on a pre-spend refusal", len(fixture.launches.receipts))
	}
	// The same operation id can be retried once consent is given (no blind receipt was written).
	if _, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "reworded", true); err != nil {
		t.Fatalf("consented retry failed: %v", err)
	}
}

func TestRecallAllowsUnconsentedWhenClockAlreadyAtToday(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	today := fixtureToday() // already at today → no sync would advance, so no consent is required
	fixture.launches.clock = &today
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)

	if _, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "reworded", false); err != nil {
		t.Fatalf("recall on an already-synced clock should not require consent, got %v", err)
	}
	if len(fixture.spendGate.intents) != 1 {
		t.Fatalf("spend intents = %d, want 1 (the recall proceeded)", len(fixture.spendGate.intents))
	}
}

func TestRecallDeniedSpendWritesNoReceipt(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.spendGate.denyErr = ErrInsufficientTwinkle
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)

	if _, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "reworded", true); !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("denied recall err = %v, want ErrInsufficientTwinkle", err)
	}
	if len(fixture.launches.receipts) != 0 {
		t.Fatalf("receipts = %d, want 0 — a rolled-back recall writes none (A3)", len(fixture.launches.receipts))
	}
	// The same operation id now does fresh work (the earlier attempt left no receipt to replay).
	fixture.spendGate.denyErr = nil
	result, err := fixture.service.Recall(context.Background(), testScope(t), "op-1", "m1", "reworded", true)
	if err != nil {
		t.Fatalf("retry after a rolled-back spend failed: %v", err)
	}
	if result.RecallCount == 0 {
		t.Fatal("the retry did no work, want a fresh recall (not an empty replay)")
	}
}

func TestDiaryRecallReplaysAndCarriesOperationIDPerMember(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1", EpisodicMemory{CurrentText: "a", Seed: seededSeed(1), BaseStrength: 0.5}, nil, nil)
	fixture.seedRecallable("m2", EpisodicMemory{CurrentText: "b", Seed: seededSeed(2), BaseStrength: 0.6}, nil, nil)
	fixture.launches.diaryMemories = map[string][]string{"d1": {"m1", "m2"}}

	first, err := fixture.service.RecallDiaryStars(context.Background(), testScope(t), "op-1", "d1", true)
	if err != nil {
		t.Fatalf("diary recall failed: %v", err)
	}
	if len(first.EpisodicMemoryIDs) != 2 {
		t.Fatalf("affected = %v, want two members", first.EpisodicMemoryIDs)
	}
	// Every member's spend carries the one operation id, so the composition-root seam derives a
	// distinct per-member dedup key (A3).
	if len(fixture.spendGate.intents) != 2 {
		t.Fatalf("spend intents = %d, want one per member", len(fixture.spendGate.intents))
	}
	for _, intent := range fixture.spendGate.intents {
		if intent.OperationID != "op-1" {
			t.Fatalf("member spend intent = %+v, want operation id op-1", intent)
		}
	}
	// Replay: same operation id replays without re-spending any member.
	second, err := fixture.service.RecallDiaryStars(context.Background(), testScope(t), "op-1", "d1", true)
	if err != nil {
		t.Fatalf("diary recall replay failed: %v", err)
	}
	if len(second.EpisodicMemoryIDs) != 2 {
		t.Fatalf("replay affected = %v, want the committed two members", second.EpisodicMemoryIDs)
	}
	if len(fixture.spendGate.intents) != 2 {
		t.Fatalf("spend intents after replay = %d, want still 2 (no member re-charged)", len(fixture.spendGate.intents))
	}
}

func TestDiaryRecallRejectsNoLiveMemories(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	// d1 resolves to zero of the caller's live memories — an all-let-go diary, or (the isolation
	// case) another user's diary, whose id references diaries() globally but yields no anchors for
	// this caller. Must be refused before spend/effects/receipt, and must not advance the clock.
	fixture.launches.diaryMemories = map[string][]string{}

	if _, err := fixture.service.RecallDiaryStars(context.Background(), testScope(t), "op-1", "d1", true); !errors.Is(err, ErrRecallNoLiveMemories) {
		t.Fatalf("empty/foreign diary recall err = %v, want ErrRecallNoLiveMemories", err)
	}
	if len(fixture.spendGate.intents) != 0 {
		t.Fatalf("spend intents = %d, want 0 (nothing to recall)", len(fixture.spendGate.intents))
	}
	if len(fixture.launches.receipts) != 0 {
		t.Fatalf("receipts = %d, want 0 — a zero-member diary recall writes no (cross-user) receipt", len(fixture.launches.receipts))
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(previous) {
		t.Fatalf("clock = %v, want unmoved (no free clock advance)", fixture.launches.clock)
	}
}

func TestViewSemanticReplaysCommittedReceipt(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedGist("m1", 3, fourStages())

	first, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1", 2)
	if err != nil {
		t.Fatalf("view failed: %v", err)
	}
	second, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1", 2)
	if err != nil {
		t.Fatalf("view replay failed: %v", err)
	}
	if second.Text != first.Text || second.Stage != first.Stage || second.ReachedStage != first.ReachedStage {
		t.Fatalf("view replay = %+v, want the committed first result %+v", second, first)
	}
	if len(fixture.spendGate.intents) != 1 {
		t.Fatalf("view spend intents = %d, want 1 (the replay does not re-spend)", len(fixture.spendGate.intents))
	}
	// Same operation id, different stage → conflict.
	if _, err := fixture.service.ViewSemantic(context.Background(), testScope(t), "op-1", "m1", 3); !errors.Is(err, ErrOperationConflict) {
		t.Fatalf("mismatched-stage replay err = %v, want ErrOperationConflict", err)
	}
}

func TestSyncStatusReflectsServerClock(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)

	behind := recallTestClock()
	fixture.launches.clock = &behind
	status, err := fixture.service.SyncStatus(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("sync status failed: %v", err)
	}
	if !status.NeedsSync || !status.Today.Equal(fixtureToday()) {
		t.Fatalf("behind-clock status = %+v, want needs_sync with today=%v", status, fixtureToday())
	}

	today := fixtureToday()
	fixture.launches.clock = &today
	status, _ = fixture.service.SyncStatus(context.Background(), testScope(t))
	if status.NeedsSync {
		t.Fatal("an already-synced clock must not need sync")
	}

	// Unborn clock with no launches: nothing to sync.
	fixture.launches.clock = nil
	fixture.launches.latestLaunched = nil
	status, _ = fixture.service.SyncStatus(context.Background(), testScope(t))
	if status.NeedsSync {
		t.Fatal("an empty universe must not need sync")
	}

	if _, err := fixture.service.SyncStatus(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("scopeless sync status err = %v, want ErrScopeRequired", err)
	}
}

func TestSyncStatusUsesUTCDateAcrossExtremeClientOffsets(t *testing.T) {
	t.Parallel()
	serverInstant := time.Date(2026, 7, 2, 0, 30, 0, 0, time.UTC)
	for _, testCase := range []struct {
		name       string
		clientZone *time.Location
		localDay   int
	}{
		{name: "UTC-minus-12 client is still on the prior date", clientZone: time.FixedZone("UTC-12", -12*60*60), localDay: 1},
		{name: "UTC-plus-14 client is on the server date", clientZone: time.FixedZone("UTC+14", 14*60*60), localDay: 2},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newFixture(t)
			fixture.service.now = func() time.Time { return serverInstant }
			behind := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
			fixture.launches.clock = &behind
			if got := serverInstant.In(testCase.clientZone).Day(); got != testCase.localDay {
				t.Fatalf("test setup local day = %d, want %d", got, testCase.localDay)
			}

			status, err := fixture.service.SyncStatus(context.Background(), testScope(t))
			if err != nil {
				t.Fatalf("SyncStatus failed: %v", err)
			}
			wantToday := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
			if !status.Today.Equal(wantToday) || !status.NeedsSync {
				t.Fatalf("status = %+v, want server UTC today %v and needs_sync", status, wantToday)
			}
		})
	}
}
