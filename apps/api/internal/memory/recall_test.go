package memory

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// --- recall fakes (methods on the shared fakeLaunchStore; fixtures declared in launch_test.go) ---

func (f *fakeLaunchStore) InRecallTx(_ context.Context, fn func(tx RecallTx) error) error {
	f.recallTxCount++
	// The recall shares the launch staging (clock advance, synapse upserts, job enqueue)
	// and adds a recall-specific recorder; both commit only when fn returns nil.
	f.staging = &launchState{}
	f.recallStaging = &recallRecord{}
	if err := fn(f); err != nil {
		f.staging = nil
		f.recallStaging = nil
		return err
	}
	f.committed = *f.staging
	if f.staging.clockAdvance != nil {
		f.clock = f.staging.clockAdvance
	}
	f.recall = *f.recallStaging
	f.staging = nil
	f.recallStaging = nil
	return nil
}

func (f *fakeLaunchStore) EpisodicMemoryForRecall(_ context.Context, scope platform.UserScope, memoryID string) (EpisodicMemory, error) {
	if scope.UserID() == "" {
		return EpisodicMemory{}, errors.New("scope missing")
	}
	if err := f.fail("EpisodicMemoryForRecall"); err != nil {
		return EpisodicMemory{}, err
	}
	mem, ok := f.recallStars[memoryID]
	if !ok {
		return EpisodicMemory{}, ErrRecallMemoryNotFound
	}
	return mem, nil
}

func (f *fakeLaunchStore) RecallMemberNeurons(_ context.Context, scope platform.UserScope, memoryID string) ([]ExistingNeuron, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	return f.recallMemberNeurons[memoryID], nil
}

func (f *fakeLaunchStore) RecallMemberSynapses(_ context.Context, scope platform.UserScope, memoryID string) ([]Synapse, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	return f.recallMemberSynapses[memoryID], nil
}

func (f *fakeLaunchStore) LiveDiaryRecallAnchors(_ context.Context, scope platform.UserScope, diaryID string) ([]DiaryRecallAnchor, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	anchors := make([]DiaryRecallAnchor, 0, len(f.diaryMemories[diaryID]))
	for _, id := range f.diaryMemories[diaryID] {
		anchors = append(anchors, recallAnchorOf(f.recallStars[id]))
	}
	return anchors, nil
}

func (f *fakeLaunchStore) NeighborSharedSemanticCounts(_ context.Context, scope platform.UserScope, memoryID string) ([]NeighborSharedSemanticCount, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	return f.recallNeighbors[memoryID], nil
}

func (f *fakeLaunchStore) ResetRecallAnchors(_ context.Context, scope platform.UserScope, memoryID string, universeTime time.Time) (RecallAnchors, error) {
	if scope.UserID() == "" {
		return RecallAnchors{}, errors.New("scope missing")
	}
	mem, ok := f.recallStars[memoryID]
	if !ok {
		return RecallAnchors{}, ErrRecallMemoryNotFound
	}
	f.recallStaging.anchorResets = append(f.recallStaging.anchorResets, recordedAnchorReset{memoryID: memoryID, universeTime: universeTime})
	// Mirror the SQL recall_count += 1 RETURNING.
	return RecallAnchors{RecallCount: mem.RecallCount + 1, BaseStrength: mem.BaseStrength}, nil
}

func (f *fakeLaunchStore) ApplyReconsolidatedText(_ context.Context, scope platform.UserScope, memoryID string, currentText string, seed int64) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	f.recallStaging.reconText = append(f.recallStaging.reconText, recordedReconText{memoryID: memoryID, currentText: currentText, seed: seed})
	return nil
}

func (f *fakeLaunchStore) AddForgettingOffset(_ context.Context, scope platform.UserScope, memoryIDs []string, delta float64) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	f.recallStaging.offsets = append(f.recallStaging.offsets, recordedOffset{memoryIDs: append([]string(nil), memoryIDs...), delta: delta})
	return nil
}

func (f *fakeLaunchStore) AppendMemoryProvenance(_ context.Context, scope platform.UserScope, entry MemoryProvenance) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	f.recallStaging.provenance = append(f.recallStaging.provenance, entry)
	return nil
}

type fakeSpendGate struct {
	denyErr error
	intents []SpendIntent
	txs     []EconomyTx
}

func (f *fakeSpendGate) CheckAndSpend(_ context.Context, scope platform.UserScope, tx EconomyTx, spend SpendIntent) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	f.intents = append(f.intents, spend)
	f.txs = append(f.txs, tx)
	return f.denyErr
}

type fakePredictionError struct {
	differs    bool
	err        error
	calls      int
	gotCurrent string
	gotRewrite string
}

func (f *fakePredictionError) Differs(_ context.Context, currentText string, rewrite string) (bool, error) {
	f.calls++
	f.gotCurrent = currentText
	f.gotRewrite = rewrite
	return f.differs, f.err
}

// --- helpers ---

func seededSeed(v int64) *int64 { return &v }

// seedRecallable configures a recallable memory with one co-activated synapse and returns
// its id. Clock starts before today so a sync advances to today.
func (fx *serviceFixture) seedRecallable(memoryID string, mem EpisodicMemory, synapses []Synapse, neighbors []NeighborSharedSemanticCount) {
	if fx.launches.recallStars == nil {
		fx.launches.recallStars = map[string]EpisodicMemory{}
		fx.launches.recallMemberSynapses = map[string][]Synapse{}
		fx.launches.recallNeighbors = map[string][]NeighborSharedSemanticCount{}
		fx.launches.recallMemberNeurons = map[string][]ExistingNeuron{}
	}
	mem.ID = memoryID
	fx.launches.recallStars[memoryID] = mem
	fx.launches.recallMemberSynapses[memoryID] = synapses
	fx.launches.recallNeighbors[memoryID] = neighbors
}

func recallTestClock() time.Time { return time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC) }

// --- tests ---

func TestRecallNoErrorBranchReinforcesOnly(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.predictionError.differs = false
	fixture.seedRecallable("m1",
		EpisodicMemory{CurrentText: "original account", Seed: seededSeed(7), RecallCount: 2, BaseStrength: 0.5},
		[]Synapse{{ID: "s1", NeuronAID: "a", NeuronBID: "b", Strength: 0.3, CoActivationCount: 1}},
		[]NeighborSharedSemanticCount{{NeighborID: "n2", SharedSemanticCount: 1}, {NeighborID: "n3", SharedSemanticCount: 2}},
	)

	result, err := fixture.service.Recall(context.Background(), testScope(t), "m1", "original account, reworded")
	if err != nil {
		t.Fatalf("Recall failed: %v", err)
	}

	// A1: sync landed at today and returned the interval.
	if result.Sync.Previous == nil || !result.Sync.Previous.Equal(previous) || !result.Sync.Current.Equal(fixtureToday()) {
		t.Fatalf("sync interval = {%v, %v}, want {%v, today}", result.Sync.Previous, result.Sync.Current, previous)
	}
	// A7: reinforce-only — text/seed unchanged, not reconsolidated, no provenance.
	if result.Reconsolidated || result.CurrentText != "original account" || result.Seed != 7 {
		t.Fatalf("reinforce-only result = %+v, want unchanged text/seed and reconsolidated=false", result)
	}
	if len(fixture.launches.recall.provenance) != 0 {
		t.Fatalf("provenance rows = %d, want 0 on reinforce-only", len(fixture.launches.recall.provenance))
	}
	if len(fixture.launches.recall.reconText) != 0 {
		t.Fatalf("current_text/seed write = %d, want 0 on reinforce-only", len(fixture.launches.recall.reconText))
	}
	// A3: anchors reset, recall_count bumped, EffectiveStrength derived.
	if result.RecallCount != 3 {
		t.Fatalf("recall_count = %d, want 3", result.RecallCount)
	}
	if want := EffectiveStrength(0.5, 3); result.EffectiveStrength != want {
		t.Fatalf("effective_strength = %v, want %v", result.EffectiveStrength, want)
	}
	if len(fixture.launches.recall.anchorResets) != 1 || fixture.launches.recall.anchorResets[0].memoryID != "m1" || !fixture.launches.recall.anchorResets[0].universeTime.Equal(fixtureToday()) {
		t.Fatalf("anchor resets = %+v, want one {m1, today}", fixture.launches.recall.anchorResets)
	}
	// A5: one LTP per edge, Potentiate applied once, co_activation delta 1, at today.
	if len(fixture.launches.committed.synapses) != 1 {
		t.Fatalf("synapse upserts = %d, want 1", len(fixture.launches.committed.synapses))
	}
	upsert := fixture.launches.committed.synapses[0]
	if want := float32(Potentiate(0.3, values.SynapsePotentiationRate)); upsert.Strength != want {
		t.Fatalf("LTP strength = %v, want Potentiate(0.3) = %v", upsert.Strength, want)
	}
	if upsert.CoActivationCount != 1 || !upsert.LastActivatedUniverseTime.Equal(fixtureToday()) {
		t.Fatalf("LTP upsert = %+v, want co_activation delta 1 at today", upsert)
	}
	// A10: neighbor ± on neighbors only — slow (-2) for the count-1 neighbor, speed (+3) for count-2.
	assertNeighborOffsets(t, fixture.launches.recall.offsets, map[string]float64{"n2": values.ReconsolidationNeighborSlowDays, "n3": values.ReconsolidationNeighborSpeedDays})
	// A6: the compare saw current vs rewrite.
	if fixture.predictionError.calls != 1 || fixture.predictionError.gotCurrent != "original account" || fixture.predictionError.gotRewrite != "original account, reworded" {
		t.Fatalf("compare = %+v, want one call over (current, rewrite)", fixture.predictionError)
	}
	// A2: one recall spend intent for the target, carrying the post-sync
	// accessibility signal — and the recall's own transaction handle, so the real
	// gate's debit joins this transaction.
	wantIntent := RecallSpendIntent("m1", recallAccessibilitySignal(recallAnchorOf(fixture.launches.recallStars["m1"]), fixtureToday()))
	if len(fixture.spendGate.intents) != 1 || fixture.spendGate.intents[0] != wantIntent {
		t.Fatalf("spend intents = %+v, want one %+v", fixture.spendGate.intents, wantIntent)
	}
	if len(fixture.spendGate.txs) != 1 || fixture.spendGate.txs[0] == nil {
		t.Fatal("the recall spend must carry the recall transaction handle")
	}
}

func TestRecallErrorBranchReconsolidates(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.predictionError.differs = true
	fixture.seeds = []int64{999} // the reshape entropy
	kept := SemanticStages{"gist-1", "gist-2", "gist-3", "gist-4"}
	fixture.seedRecallable("m1",
		EpisodicMemory{CurrentText: "old", Seed: seededSeed(7), RecallCount: 0, BaseStrength: 0.4, SemanticStage: 2, SemanticStages: &kept, Emotion: Emotion{Mood: MoodJoy}},
		[]Synapse{{ID: "s1", NeuronAID: "a", NeuronBID: "b", Strength: 0.3, CoActivationCount: 1}},
		nil,
	)
	fixture.launches.recallMemberNeurons["m1"] = []ExistingNeuron{{ID: "a", Name: "market", Type: NeuronTypeSpatial}}

	result, err := fixture.service.Recall(context.Background(), testScope(t), "m1", "a genuinely different memory")
	if err != nil {
		t.Fatalf("Recall failed: %v", err)
	}

	// A8: text rewritten, seed changed (Reshape(7,999)=999), reconsolidated=true.
	if !result.Reconsolidated || result.CurrentText != "a genuinely different memory" || result.Seed != 999 {
		t.Fatalf("reconsolidation result = %+v, want rewritten text + seed 999 + reconsolidated=true", result)
	}
	if len(fixture.launches.recall.reconText) != 1 || fixture.launches.recall.reconText[0].seed != 999 || fixture.launches.recall.reconText[0].currentText != "a genuinely different memory" {
		t.Fatalf("current_text/seed write = %+v, want one {m1, new text, 999}", fixture.launches.recall.reconText)
	}
	// A8: one reconsolidated/user provenance row at today.
	if len(fixture.launches.recall.provenance) != 1 {
		t.Fatalf("provenance rows = %d, want 1", len(fixture.launches.recall.provenance))
	}
	prov := fixture.launches.recall.provenance[0]
	if prov.Kind != ProvenanceKindReconsolidated || prov.Source != ProvenanceSourceUser || prov.Text != "a genuinely different memory" || !prov.UniverseTime.Equal(fixtureToday()) {
		t.Fatalf("provenance = %+v, want reconsolidated/user/new-text/today", prov)
	}
	// A8: regen job enqueued, keeping the 2 already-risen stages, on the new text.
	if len(fixture.launches.committed.jobs) != 1 {
		t.Fatalf("enqueued jobs = %d, want 1 regen job", len(fixture.launches.committed.jobs))
	}
	var payload SemanticizeJobPayload
	if err := json.Unmarshal(fixture.launches.committed.jobs[0].Payload, &payload); err != nil {
		t.Fatalf("decode regen payload: %v", err)
	}
	if payload.CurrentText != "a genuinely different memory" || payload.KeepStages != 2 || payload.KeptStages == nil || *payload.KeptStages != kept {
		t.Fatalf("regen payload = %+v, want new text + keep 2 already-risen stages", payload)
	}
}

func TestReconsolidateRegenKeepsRisenStages(t *testing.T) {
	t.Parallel()
	// The worker merge honors [C7]: keep the first KeepStages already-risen texts, take the
	// regenerated rest — the reconsolidation regen's core contract.
	regenerated := SemanticStages{"gen-0", "gen-1", "gen-2", "gen-3"}
	kept := SemanticStages{"keep-0", "keep-1", "old-2", "old-3"}
	semanticizer := &fakeSemanticizer{stages: regenerated}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, writer)

	payload, _ := json.Marshal(SemanticizeJobPayload{MemoryID: "m1", CurrentText: "new", KeepStages: 2, KeptStages: &kept})
	if err := handler(context.Background(), Job{UserID: "user-1", Payload: payload}); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	want := SemanticStages{"keep-0", "keep-1", "gen-2", "gen-3"}
	if writer.stages != want {
		t.Fatalf("saved stages = %v, want first two kept + rest regenerated %v", writer.stages, want)
	}
}

func TestLaunchSemanticizeKeepsNothing(t *testing.T) {
	t.Parallel()
	// A launch semanticize carries no keep boundary, so it writes all four generated texts —
	// the reconsolidation fields are additive and do not change launch behavior.
	regenerated := SemanticStages{"gen-0", "gen-1", "gen-2", "gen-3"}
	semanticizer := &fakeSemanticizer{stages: regenerated}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, writer)

	payload, _ := json.Marshal(SemanticizeJobPayload{MemoryID: "m1", CurrentText: "body"})
	if err := handler(context.Background(), Job{UserID: "user-1", Payload: payload}); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if writer.stages != regenerated {
		t.Fatalf("saved stages = %v, want all regenerated %v", writer.stages, regenerated)
	}
}

func TestRecallNeighborSelectionByCount(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1",
		EpisodicMemory{CurrentText: "x", Seed: seededSeed(1), BaseStrength: 0.5},
		nil,
		[]NeighborSharedSemanticCount{
			{NeighborID: "zero", SharedSemanticCount: 0},
			{NeighborID: "one", SharedSemanticCount: 1},
			{NeighborID: "two", SharedSemanticCount: 2},
			{NeighborID: "three", SharedSemanticCount: 3},
		},
	)

	if _, err := fixture.service.Recall(context.Background(), testScope(t), "m1", "reworded"); err != nil {
		t.Fatalf("Recall failed: %v", err)
	}
	// count 0 → no offset; count 1 → slow; count >= 2 → speed. The recalled memory gets no
	// self-offset (it recovers wholly [F5]).
	assertNeighborOffsets(t, fixture.launches.recall.offsets, map[string]float64{
		"one":   values.ReconsolidationNeighborSlowDays,
		"two":   values.ReconsolidationNeighborSpeedDays,
		"three": values.ReconsolidationNeighborSpeedDays,
	})
	for _, offset := range fixture.launches.recall.offsets {
		for _, id := range offset.memoryIDs {
			if id == "m1" {
				t.Fatal("the recalled memory must never receive a self-offset")
			}
		}
	}
}

func TestRecallSpendDenialResetsNothing(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.spendGate.denyErr = ErrInsufficientTwinkle
	fixture.seedRecallable("m1", EpisodicMemory{CurrentText: "x", Seed: seededSeed(1), BaseStrength: 0.5}, nil, nil)

	_, err := fixture.service.Recall(context.Background(), testScope(t), "m1", "reworded")
	if !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want ErrInsufficientTwinkle", err)
	}
	// A2: nothing reset — no anchors, no LTP, no offsets, no provenance; the clock did not move.
	if len(fixture.launches.recall.anchorResets) != 0 || len(fixture.launches.committed.synapses) != 0 || len(fixture.launches.recall.offsets) != 0 || len(fixture.launches.recall.provenance) != 0 {
		t.Fatal("a denied spend must reset nothing")
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(previous) {
		t.Fatalf("clock = %v, want rolled back to %v", fixture.launches.clock, previous)
	}
	// The spend gates the LLM: a denied recall never pays for the compare.
	if fixture.predictionError.calls != 0 {
		t.Fatalf("compare calls = %d, want 0 when the spend is denied", fixture.predictionError.calls)
	}
}

func TestRecallRejectsDeletedAndMissingTargets(t *testing.T) {
	t.Parallel()
	deletedAt := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	fixture := newFixture(t)
	fixture.launches.clock = seededTimePtr(recallTestClock())
	fixture.seedRecallable("gone", EpisodicMemory{CurrentText: "x", Seed: seededSeed(1), DeletedAt: &deletedAt}, nil, nil)

	if _, err := fixture.service.Recall(context.Background(), testScope(t), "gone", "reworded"); !errors.Is(err, ErrRecallMemoryUnavailable) {
		t.Fatalf("deleted target err = %v, want ErrRecallMemoryUnavailable", err)
	}
	if _, err := fixture.service.Recall(context.Background(), testScope(t), "never", "reworded"); !errors.Is(err, ErrRecallMemoryNotFound) {
		t.Fatalf("missing target err = %v, want ErrRecallMemoryNotFound", err)
	}
}

func TestRecallDiaryStarsReinforcesEveryLiveMemory(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1",
		EpisodicMemory{CurrentText: "a", Seed: seededSeed(1), BaseStrength: 0.5},
		[]Synapse{{ID: "s1", NeuronAID: "a", NeuronBID: "b", Strength: 0.3, CoActivationCount: 1}},
		nil,
	)
	fixture.seedRecallable("m2",
		EpisodicMemory{CurrentText: "b", Seed: seededSeed(2), BaseStrength: 0.6},
		[]Synapse{{ID: "s2", NeuronAID: "c", NeuronBID: "d", Strength: 0.2, CoActivationCount: 1}},
		nil,
	)
	fixture.launches.diaryMemories = map[string][]string{"d1": {"m1", "m2"}}

	result, err := fixture.service.RecallDiaryStars(context.Background(), testScope(t), "d1")
	if err != nil {
		t.Fatalf("RecallDiaryStars failed: %v", err)
	}
	// A11: every live memory reinforced in one tx; no compare, no reconsolidate.
	if len(result.EpisodicMemoryIDs) != 2 || result.EpisodicMemoryIDs[0] != "m1" || result.EpisodicMemoryIDs[1] != "m2" {
		t.Fatalf("affected ids = %v, want [m1 m2]", result.EpisodicMemoryIDs)
	}
	if !result.Sync.Current.Equal(fixtureToday()) {
		t.Fatalf("sync current = %v, want today", result.Sync.Current)
	}
	if fixture.predictionError.calls != 0 {
		t.Fatalf("compare calls = %d, want 0 for a whole-diary recall", fixture.predictionError.calls)
	}
	if len(fixture.launches.recall.provenance) != 0 || len(fixture.launches.recall.reconText) != 0 {
		t.Fatal("a whole-diary recall must not reconsolidate")
	}
	if len(fixture.launches.recall.anchorResets) != 2 || len(fixture.launches.committed.synapses) != 2 {
		t.Fatalf("reinforce = %d anchors / %d synapses, want 2 / 2", len(fixture.launches.recall.anchorResets), len(fixture.launches.committed.synapses))
	}
	if len(fixture.spendGate.intents) != 2 {
		t.Fatalf("spend intents = %d, want one per memory", len(fixture.spendGate.intents))
	}
}

func TestRecallRequiresScopeAndInput(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.service.Recall(context.Background(), platform.UserScope{}, "m1", "x"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("scopeless recall err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.Recall(context.Background(), testScope(t), "m1", "  "); !errors.Is(err, ErrRecallInputRequired) {
		t.Fatalf("empty rewrite err = %v, want ErrRecallInputRequired", err)
	}
	if _, err := fixture.service.Recall(context.Background(), testScope(t), "", "rewrite"); !errors.Is(err, ErrRecallInputRequired) {
		t.Fatalf("empty memory id err = %v, want ErrRecallInputRequired", err)
	}
	if _, err := fixture.service.RecallDiaryStars(context.Background(), testScope(t), ""); !errors.Is(err, ErrRecallInputRequired) {
		t.Fatalf("empty diary id err = %v, want ErrRecallInputRequired", err)
	}
	if fixture.launches.recallTxCount != 0 {
		t.Fatal("invalid input must be rejected before the transaction")
	}
}

func seededTimePtr(t time.Time) *time.Time { return &t }

// assertNeighborOffsets flattens the recorded offset writes into per-neighbor deltas and
// checks they match the expectation exactly.
func assertNeighborOffsets(t *testing.T, offsets []recordedOffset, want map[string]float64) {
	t.Helper()
	got := map[string]float64{}
	for _, offset := range offsets {
		for _, id := range offset.memoryIDs {
			got[id] = offset.delta
		}
	}
	if len(got) != len(want) {
		t.Fatalf("neighbor offsets = %v, want %v", got, want)
	}
	for id, delta := range want {
		if got[id] != delta {
			t.Fatalf("neighbor %q offset = %v, want %v", id, got[id], delta)
		}
	}
}
