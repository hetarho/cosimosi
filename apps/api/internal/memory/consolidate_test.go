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

// The fixture memories keep arousal = 0 and base strength / recall count = 0 so the shared
// slow factor is exactly 1 and the timer/decay day math in assertions stays whole-numbered
// (gist unit = semantic.gist_units_per_stage days, decay stage = forgetting.stage_interval_days).

func consolidateDate(day int) time.Time {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, day)
}

func fullStages() *SemanticStages {
	return &SemanticStages{"gist-1", "gist-2", "gist-3", "gist-4"}
}

func plainConsolidateMemory(id string, created time.Time) EpisodicMemory {
	seed := int64(42)
	return EpisodicMemory{
		ID:                  id,
		DiaryID:             "diary-" + id,
		Name:                "memory " + id,
		CurrentText:         "I walked to the harbor and watched the boats until sunset came.",
		Seed:                &seed,
		Emotion:             Emotion{Mood: MoodNeutral, Arousal: 0},
		CreatedUniverseTime: created,
		SemanticStages:      fullStages(),
	}
}

type fakeSynapseRow struct {
	id            string
	strength      float64
	lastActivated time.Time
}

type fakeConsolidateTx struct {
	memories        []EpisodicMemory
	memberNeurons   map[string][]ExistingNeuron
	neuronMemories  map[string][]string
	synapses        []fakeSynapseRow
	listCalls       int
	provenance      []MemoryProvenance
	advances        []StageAdvance
	decayFills      map[string][]string
	touchedNeurons  [][]string
	touchedAt       time.Time
	downscaled      []SynapseStrength
	downscaleCalls  int
	jobs            []Job
	listMemoriesErr error
}

func newFakeConsolidateTx() *fakeConsolidateTx {
	return &fakeConsolidateTx{
		memberNeurons:  map[string][]ExistingNeuron{},
		neuronMemories: map[string][]string{},
		decayFills:     map[string][]string{},
	}
}

func (f *fakeConsolidateTx) EnqueueJob(_ context.Context, _ platform.UserScope, job Job) (Job, error) {
	f.jobs = append(f.jobs, job)
	return job, nil
}

func (f *fakeConsolidateTx) LockUniverseClock(context.Context, platform.UserScope) error {
	return nil
}

func (f *fakeConsolidateTx) UniverseClock(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}

func (f *fakeConsolidateTx) UniverseClockForUpdate(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}

func (f *fakeConsolidateTx) LatestLaunchedUniverseTime(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}

func (f *fakeConsolidateTx) AdvanceUniverseClock(_ context.Context, _ platform.UserScope, target time.Time) (time.Time, error) {
	return target, nil
}

func (f *fakeConsolidateTx) AppendMemoryProvenance(_ context.Context, _ platform.UserScope, entry MemoryProvenance) error {
	f.provenance = append(f.provenance, entry)
	return nil
}

func (f *fakeConsolidateTx) ListMemoriesForConsolidation(context.Context, platform.UserScope) ([]EpisodicMemory, error) {
	f.listCalls++
	if f.listMemoriesErr != nil {
		return nil, f.listMemoriesErr
	}
	out := make([]EpisodicMemory, len(f.memories))
	copy(out, f.memories)
	return out, nil
}

func (f *fakeConsolidateTx) RecallMemberNeurons(_ context.Context, _ platform.UserScope, memoryID string) ([]ExistingNeuron, error) {
	return f.memberNeurons[memoryID], nil
}

func (f *fakeConsolidateTx) ApplyStageAdvances(_ context.Context, _ platform.UserScope, advances []StageAdvance) error {
	f.advances = append(f.advances, advances...)
	return nil
}

func (f *fakeConsolidateTx) FillDecayStages(_ context.Context, _ platform.UserScope, memoryID string, stages []string) error {
	f.decayFills[memoryID] = stages
	return nil
}

func (f *fakeConsolidateTx) ReplaySetNeurons(_ context.Context, _ platform.UserScope, memoryIDs []string) ([]ExistingNeuron, error) {
	seen := map[string]struct{}{}
	neurons := make([]ExistingNeuron, 0)
	for _, memoryID := range memoryIDs {
		for _, neuron := range f.memberNeurons[memoryID] {
			if _, ok := seen[neuron.ID]; ok {
				continue
			}
			seen[neuron.ID] = struct{}{}
			neurons = append(neurons, neuron)
		}
	}
	return neurons, nil
}

func (f *fakeConsolidateTx) MemoriesActivatingNeurons(_ context.Context, _ platform.UserScope, neuronIDs []string) ([]string, error) {
	seen := map[string]struct{}{}
	ids := make([]string, 0)
	for _, neuronID := range neuronIDs {
		for _, memoryID := range f.neuronMemories[neuronID] {
			if _, ok := seen[memoryID]; ok {
				continue
			}
			seen[memoryID] = struct{}{}
			ids = append(ids, memoryID)
		}
	}
	return ids, nil
}

func (f *fakeConsolidateTx) TouchReplaySetSynapses(_ context.Context, _ platform.UserScope, neuronIDs []string, universeTime time.Time) error {
	f.touchedNeurons = append(f.touchedNeurons, neuronIDs)
	f.touchedAt = universeTime
	return nil
}

func (f *fakeConsolidateTx) ListSynapseStrengths(_ context.Context, _ platform.UserScope, activatedBefore time.Time) ([]SynapseStrength, error) {
	out := make([]SynapseStrength, 0, len(f.synapses))
	for _, synapse := range f.synapses {
		if !synapse.lastActivated.Before(activatedBefore) {
			continue
		}
		out = append(out, SynapseStrength{SynapseID: synapse.id, Strength: synapse.strength})
	}
	return out, nil
}

func (f *fakeConsolidateTx) ApplySynapseDownscale(_ context.Context, _ platform.UserScope, updates []SynapseStrength) error {
	f.downscaleCalls++
	f.downscaled = append(f.downscaled, updates...)
	// Mirror the store: rows update in place, count unchanged.
	for _, update := range updates {
		for i := range f.synapses {
			if f.synapses[i].id == update.SynapseID {
				f.synapses[i].strength = update.Strength
			}
		}
	}
	return nil
}

// applyPersistedState folds the recorded stage advances and decay fills back into the fake's
// memories, simulating what the committed transaction leaves for a later advance to read.
func (f *fakeConsolidateTx) applyPersistedState() {
	for _, advance := range f.advances {
		for i := range f.memories {
			if f.memories[i].ID != advance.MemoryID {
				continue
			}
			f.memories[i].SemanticStage = advance.Stage
			anchor := advance.TimerResetAt
			f.memories[i].SemanticizeTimerResetAt = &anchor
		}
	}
	for memoryID, stages := range f.decayFills {
		for i := range f.memories {
			if f.memories[i].ID == memoryID {
				f.memories[i].DecayStages = stages
			}
		}
	}
	f.advances = nil
	f.decayFills = map[string][]string{}
	f.provenance = nil
	f.touchedNeurons = nil
	f.jobs = nil
	f.downscaled = nil
	f.downscaleCalls = 0
}

func runConsolidator(t *testing.T, tx *fakeConsolidateTx, from *time.Time, to time.Time) {
	t.Helper()
	handler := NewConsolidator(newSequentialID("consolidate"))
	if err := handler.OnAdvance(context.Background(), testScope(t), tx, from, to); err != nil {
		t.Fatalf("OnAdvance failed: %v", err)
	}
}

func newSequentialID(prefix string) func() string {
	counter := 0
	return func() string {
		counter++
		return prefix + "-" + string(rune('a'+counter-1))
	}
}

func TestConsolidateHeldOrFirstAdvanceIsANoop(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(0))}
	tx.synapses = []fakeSynapseRow{{id: "s1", strength: 0.5, lastActivated: consolidateDate(0)}}
	day := consolidateDate(20)

	// from == to: a held clock crosses no interval (A10).
	runConsolidator(t, tx, &day, day)
	// to < from: a rewind can never consolidate ([I10]).
	earlier := consolidateDate(10)
	runConsolidator(t, tx, &day, earlier)
	// from == nil: the first-ever advance has no prior interval to sleep over.
	runConsolidator(t, tx, nil, day)

	if tx.listCalls != 0 || len(tx.advances) != 0 || len(tx.provenance) != 0 ||
		len(tx.decayFills) != 0 || len(tx.touchedNeurons) != 0 || len(tx.downscaled) != 0 || len(tx.jobs) != 0 {
		t.Fatalf("no-op advance touched state: %+v", tx)
	}
}

func TestConsolidateRequiresScopeAndConsolidateTx(t *testing.T) {
	t.Parallel()
	handler := NewConsolidator(nil)
	from := consolidateDate(0)
	to := consolidateDate(20)

	if err := handler.OnAdvance(context.Background(), platform.UserScope{}, newFakeConsolidateTx(), &from, to); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("scope-less advance err = %v, want ErrScopeRequired", err)
	}
	// A ProgressionTx that cannot be upgraded to the consolidation surface is a wiring
	// error, surfaced loudly instead of silently skipping the sleep.
	if err := handler.OnAdvance(context.Background(), testScope(t), progressionOnlyTx{}, &from, to); !errors.Is(err, ErrConsolidateTxRequired) {
		t.Fatalf("narrow tx err = %v, want ErrConsolidateTxRequired", err)
	}
}

type progressionOnlyTx struct{}

func (progressionOnlyTx) EnqueueJob(_ context.Context, _ platform.UserScope, job Job) (Job, error) {
	return job, nil
}
func (progressionOnlyTx) LockUniverseClock(context.Context, platform.UserScope) error { return nil }
func (progressionOnlyTx) UniverseClock(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}
func (progressionOnlyTx) UniverseClockForUpdate(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}
func (progressionOnlyTx) LatestLaunchedUniverseTime(context.Context, platform.UserScope) (*time.Time, error) {
	return nil, nil
}
func (progressionOnlyTx) AdvanceUniverseClock(_ context.Context, _ platform.UserScope, target time.Time) (time.Time, error) {
	return target, nil
}

func TestConsolidateAdvancesAllCrossedStagesClampedWithProvenance(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	// 45 days at unit length 10 → 4 whole units; the ladder clamps at stage 4 ([C7]).
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(0))}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	from := consolidateDate(0)
	to := consolidateDate(45)

	runConsolidator(t, tx, &from, to)

	if len(tx.advances) != 1 {
		t.Fatalf("advances = %d, want 1", len(tx.advances))
	}
	advance := tx.advances[0]
	if advance.MemoryID != "m1" || advance.Stage != 4 {
		t.Fatalf("advance = %+v, want m1 risen to the stage-4 ceiling", advance)
	}
	// 4 units at 10 unmodulated days each = 40 consumed days; the 5 residual days carry.
	if want := consolidateDate(40); !advance.TimerResetAt.Equal(want) {
		t.Fatalf("consumed anchor = %v, want %v", advance.TimerResetAt, want)
	}
	// One semanticized/system 변천사 row per crossed stage, carrying the pregenerated text,
	// anchored at the advance time (CC5, [R8a]).
	if len(tx.provenance) != 4 {
		t.Fatalf("provenance rows = %d, want 4", len(tx.provenance))
	}
	for i, entry := range tx.provenance {
		if entry.Kind != ProvenanceKindSemanticized || entry.Source != ProvenanceSourceSystem {
			t.Fatalf("provenance[%d] = %s/%s, want semanticized/system", i, entry.Kind, entry.Source)
		}
		if want := fullStages()[i]; entry.Text != want {
			t.Fatalf("provenance[%d] text = %q, want %q", i, entry.Text, want)
		}
		if !entry.UniverseTime.Equal(to) {
			t.Fatalf("provenance[%d] universe time = %v, want %v", i, entry.UniverseTime, to)
		}
	}
	// All stage texts exist, so no semanticize regen; the only job is the consolidate kind.
	for _, job := range tx.jobs {
		if job.Kind == JobKindSemanticize {
			t.Fatal("pregenerated stages must not re-enqueue semanticize ([C7])")
		}
	}
}

func TestConsolidateFreshTimerAnchorAdvancesNothing(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	recalled := plainConsolidateMemory("m1", consolidateDate(0))
	// A recall five days ago reset the gist timer; 5 days < one 10-day unit ([C6a][F5]).
	anchor := consolidateDate(40)
	recalled.SemanticizeTimerResetAt = &anchor
	recalled.SemanticStage = 2
	tx.memories = []EpisodicMemory{recalled}
	from := consolidateDate(40)
	to := consolidateDate(45)

	runConsolidator(t, tx, &from, to)

	if len(tx.advances) != 0 || len(tx.provenance) != 0 {
		t.Fatalf("fresh-anchor advance rose a stage: %+v", tx.advances)
	}
}

func TestConsolidateResidualTimerProgressCarriesExactly(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(0))}
	from := consolidateDate(0)

	// Day 24: 2 units crossed, 4 residual days.
	runConsolidator(t, tx, &from, consolidateDate(24))
	if len(tx.advances) != 1 || tx.advances[0].Stage != 2 {
		t.Fatalf("advances = %+v, want one rise to stage 2", tx.advances)
	}
	if want := consolidateDate(20); !tx.advances[0].TimerResetAt.Equal(want) {
		t.Fatalf("consumed anchor = %v, want exactly the crossed units' span %v", tx.advances[0].TimerResetAt, want)
	}
	tx.applyPersistedState()

	// Day 26: only 6 days since the consumed anchor — the residual must not refund a unit.
	day24 := consolidateDate(24)
	runConsolidator(t, tx, &day24, consolidateDate(26))
	if len(tx.advances) != 0 {
		t.Fatalf("stage rose early on residual days: %+v", tx.advances)
	}
	tx.applyPersistedState()

	// Day 30: 10 days since the consumed anchor — the third stage rises exactly on schedule.
	day26 := consolidateDate(26)
	runConsolidator(t, tx, &day26, consolidateDate(30))
	if len(tx.advances) != 1 || tx.advances[0].Stage != 3 {
		t.Fatalf("advances = %+v, want the on-schedule rise to stage 3", tx.advances)
	}
}

func TestConsolidateRerunOfConsolidatedIntervalConverges(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(0))}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	from := consolidateDate(0)
	to := consolidateDate(35)

	runConsolidator(t, tx, &from, to)
	if len(tx.advances) != 1 || tx.advances[0].Stage != 3 || len(tx.decayFills["m1"]) == 0 {
		t.Fatalf("first run advances = %+v fills = %+v", tx.advances, tx.decayFills)
	}
	firstFill := tx.decayFills["m1"]
	tx.applyPersistedState()

	// The consumed anchor + the never-overwrite merge make a re-run of the very same
	// interval a no-op: no stage, no provenance, no fill, no consolidate job (A10).
	runConsolidator(t, tx, &from, to)
	if len(tx.advances) != 0 || len(tx.provenance) != 0 || len(tx.jobs) != 0 {
		t.Fatalf("re-run advanced again: advances=%+v provenance=%d jobs=%d", tx.advances, len(tx.provenance), len(tx.jobs))
	}
	if len(tx.decayFills) != 0 {
		t.Fatalf("re-run rewrote decay stages: %+v", tx.decayFills)
	}
	if got := tx.memories[0].DecayStages; len(got) != len(firstFill) {
		t.Fatalf("decay stages changed across re-run: %v vs %v", got, firstFill)
	}
}

func TestConsolidatePersistsNewlyReachedDecayStageTexts(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	episodicMemory := plainConsolidateMemory("m1", consolidateDate(0))
	// Stage 1's text was already persisted by an earlier advance; it must survive verbatim
	// even though the deterministic algorithm would produce different bytes.
	episodicMemory.DecayStages = []string{"already persisted stage one"}
	tx.memories = []EpisodicMemory{episodicMemory}
	// 30-day stages: from day 40 (stage 1) to day 95 (stage 3) newly crosses 2 and 3.
	from := consolidateDate(40)
	to := consolidateDate(95)

	runConsolidator(t, tx, &from, to)

	filled, ok := tx.decayFills["m1"]
	if !ok {
		t.Fatal("decay stages were not persisted")
	}
	if len(filled) != 3 {
		t.Fatalf("filled stages = %d, want 3", len(filled))
	}
	if filled[0] != "already persisted stage one" {
		t.Fatalf("existing stage text overwritten: %q", filled[0])
	}
	seed := int64(42)
	for stage := 2; stage <= 3; stage++ {
		want := DecayStageText(episodicMemory.CurrentText, stage, seed)
		if filled[stage-1] != want {
			t.Fatalf("stage %d text = %q, want deterministic %q", stage, filled[stage-1], want)
		}
	}

	// Re-run with the persisted state: identical bytes, no rewrite (seeded determinism).
	tx.applyPersistedState()
	runConsolidator(t, tx, &from, to)
	if len(tx.decayFills) != 0 {
		t.Fatalf("re-run rewrote decay stages: %+v", tx.decayFills)
	}
}

func TestConsolidateMarksReplayBoundedToReplaySet(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	advancing := plainConsolidateMemory("m1", consolidateDate(0))
	neighborViaSharedNeuron := plainConsolidateMemory("m2", consolidateDate(24))
	neighborViaSharedNeuron.SemanticStage = 4 // at the ceiling: no advance of its own
	unrelated := plainConsolidateMemory("m3", consolidateDate(24))
	unrelated.SemanticStage = 4
	tx.memories = []EpisodicMemory{advancing, neighborViaSharedNeuron, unrelated}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	tx.memberNeurons["m2"] = []ExistingNeuron{
		{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic},
		{ID: "n2", Name: "boat", Type: NeuronTypeSemantic},
	}
	tx.memberNeurons["m3"] = []ExistingNeuron{{ID: "n3", Name: "island", Type: NeuronTypeSemantic}}
	tx.neuronMemories["n1"] = []string{"m1", "m2"}
	tx.neuronMemories["n2"] = []string{"m2"}
	tx.neuronMemories["n3"] = []string{"m3"}
	from := consolidateDate(24)
	to := consolidateDate(35)

	runConsolidator(t, tx, &from, to)

	// m1 advanced; its replay set is m1 + the shared-neuron neighbor m2 → neurons n1, n2.
	// The unrelated m3/n3 cluster is outside the hop bound and never marked ([C2]).
	if len(tx.touchedNeurons) != 1 {
		t.Fatalf("touch calls = %d, want 1", len(tx.touchedNeurons))
	}
	touched := map[string]bool{}
	for _, id := range tx.touchedNeurons[0] {
		touched[id] = true
	}
	if !touched["n1"] || !touched["n2"] || touched["n3"] {
		t.Fatalf("touched neurons = %v, want the m1∪m2 replay set without n3", tx.touchedNeurons[0])
	}
	if !tx.touchedAt.Equal(to) {
		t.Fatalf("touch universe time = %v, want the advance time %v", tx.touchedAt, to)
	}
}

func TestConsolidateDownscalesSleptSynapsesThroughThePureFn(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(20))}
	from := consolidateDate(20)
	to := consolidateDate(25)
	tx.synapses = []fakeSynapseRow{
		{id: "s-weak", strength: 0.2, lastActivated: consolidateDate(0)},
		{id: "s-strong", strength: 0.8, lastActivated: consolidateDate(20)},
		{id: "s-floor", strength: 0.04, lastActivated: consolidateDate(0)},
		// Activated AT the advance target — linked inside this very transaction, so it
		// never slept through the interval and must not be renormalized.
		{id: "s-fresh", strength: 0.32, lastActivated: to},
	}

	runConsolidator(t, tx, &from, to)

	if tx.downscaleCalls != 1 {
		t.Fatalf("downscale batches = %d, want one scoped batch per sleep", tx.downscaleCalls)
	}
	// Values come from the pure fn; the at/below-floor edge is untouched (skipped, not
	// deleted), the fresh edge is outside the slept set, and the fake's row count never
	// changes ([I1][C4]).
	byID := map[string]float64{}
	for _, update := range tx.downscaled {
		byID[update.SynapseID] = update.Strength
	}
	if got, want := byID["s-weak"], Downscale(0.2, values.ConsolidationDownscaleFactor); got != want {
		t.Fatalf("weak downscale = %v, want %v", got, want)
	}
	if got, want := byID["s-strong"], Downscale(0.8, values.ConsolidationDownscaleFactor); got != want {
		t.Fatalf("strong downscale = %v, want %v", got, want)
	}
	if _, wrote := byID["s-floor"]; wrote {
		t.Fatal("an edge the floor already holds must not be rewritten")
	}
	if _, wrote := byID["s-fresh"]; wrote {
		t.Fatal("an edge activated at the advance target must not be downscaled")
	}
	weakLoss := 1 - byID["s-weak"]/0.2
	strongLoss := 1 - byID["s-strong"]/0.8
	if weakLoss <= strongLoss {
		t.Fatalf("weak edge lost %v, strong %v — want proportionally more on the weak edge", weakLoss, strongLoss)
	}
	if len(tx.synapses) != 4 {
		t.Fatalf("synapse rows = %d, want 4 — downscale never removes an edge", len(tx.synapses))
	}
}

func TestConsolidateRepairsMissingStageTextsAtTheCeiling(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	// The memory's ladder is fully risen but its pregenerated texts never landed (a dead
	// semanticize job): no further stage can cross, yet the regen must still re-enqueue or
	// the gist stays unviewable forever ([C7], A9).
	stuck := plainConsolidateMemory("m1", consolidateDate(0))
	stuck.SemanticStage = 4
	stuck.SemanticStages = nil
	tx.memories = []EpisodicMemory{stuck}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	from := consolidateDate(40)
	to := consolidateDate(45)

	runConsolidator(t, tx, &from, to)

	var semanticize *Job
	for i := range tx.jobs {
		if tx.jobs[i].Kind == JobKindSemanticize {
			semanticize = &tx.jobs[i]
		}
	}
	if semanticize == nil {
		t.Fatal("a ceiling memory with missing stage texts did not re-enqueue semanticize")
	}
	var payload SemanticizeJobPayload
	if err := json.Unmarshal(semanticize.Payload, &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if payload.MemoryID != "m1" || payload.KeepStages != 0 {
		t.Fatalf("payload = %+v, want m1 keeping nothing", payload)
	}
	if len(tx.advances) != 0 {
		t.Fatalf("advances = %+v, want none at the ceiling", tx.advances)
	}
}

func TestConsolidateEnqueuesHeavyWorkNotInlineLLM(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	tx.memories = []EpisodicMemory{plainConsolidateMemory("m1", consolidateDate(0))}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	tx.neuronMemories["n1"] = []string{"m1"}
	from := consolidateDate(0)
	to := consolidateDate(12)

	runConsolidator(t, tx, &from, to)

	// The advance transaction never calls an LLM/embedder — the fake has none to call; the
	// interval's heavy work is one consolidate job on the queue ([C7], §2.8).
	if len(tx.jobs) != 1 {
		t.Fatalf("jobs = %d, want the one consolidate job", len(tx.jobs))
	}
	job := tx.jobs[0]
	if job.Kind != JobKindConsolidate {
		t.Fatalf("job kind = %s, want consolidate", job.Kind)
	}
	var payload ConsolidateJobPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if payload.FromUniverseTime != "2026-01-01" || payload.ToUniverseTime != "2026-01-13" {
		t.Fatalf("payload interval = %s..%s", payload.FromUniverseTime, payload.ToUniverseTime)
	}
	if len(payload.MemoryIDs) != 1 || payload.MemoryIDs[0] != "m1" {
		t.Fatalf("payload memories = %v, want [m1]", payload.MemoryIDs)
	}
	if len(payload.NeuronIDs) != 1 || payload.NeuronIDs[0] != "n1" {
		t.Fatalf("payload neuron ids = %v, want the replay-set neuron id only (texts re-read at execution)", payload.NeuronIDs)
	}
}

func TestConsolidateReenqueuesSemanticizeOnlyForMissingStageTexts(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	episodicMemory := plainConsolidateMemory("m1", consolidateDate(0))
	// The launch pregeneration landed only stage 1; the rise to stage 2 finds its text
	// missing, so the regen is re-enqueued keeping the one good leading text ([C7]).
	episodicMemory.SemanticStages = &SemanticStages{"gist-1", "", "", ""}
	tx.memories = []EpisodicMemory{episodicMemory}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	tx.neuronMemories["n1"] = []string{"m1"}
	from := consolidateDate(0)
	to := consolidateDate(24)

	runConsolidator(t, tx, &from, to)

	var semanticize *Job
	for i := range tx.jobs {
		if tx.jobs[i].Kind == JobKindSemanticize {
			semanticize = &tx.jobs[i]
		}
	}
	if semanticize == nil {
		t.Fatal("missing stage text did not re-enqueue semanticize")
	}
	var payload SemanticizeJobPayload
	if err := json.Unmarshal(semanticize.Payload, &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if payload.MemoryID != "m1" || payload.KeepStages != 1 {
		t.Fatalf("payload = %+v, want m1 keeping the 1 leading text", payload)
	}
	if payload.KeptStages == nil || payload.KeptStages[0] != "gist-1" {
		t.Fatalf("kept stages = %+v, want the existing gist-1 carried", payload.KeptStages)
	}
	// The rise itself still materialized and left its 변천사 rows (with empty text where
	// the pregenerated string is missing — the row anchors the event).
	if len(tx.advances) != 1 || tx.advances[0].Stage != 2 {
		t.Fatalf("advances = %+v, want the rise to stage 2", tx.advances)
	}
}

func TestMergeDecayStageTextsNeverShrinksOrOverwrites(t *testing.T) {
	t.Parallel()
	existing := []string{"one", "", "three", "four", "five"}
	merged, changed := mergeDecayStageTexts(existing, "some current text to redact", 2, 7)
	if !changed {
		t.Fatal("missing slot 2 was not filled")
	}
	if len(merged) != 5 {
		t.Fatalf("merged length = %d, want the existing tail kept", len(merged))
	}
	if merged[0] != "one" || merged[2] != "three" || merged[4] != "five" {
		t.Fatalf("existing entries changed: %v", merged)
	}
	if merged[1] != DecayStageText("some current text to redact", 2, 7) {
		t.Fatalf("slot 2 = %q, want the deterministic text", merged[1])
	}
	if _, changedAgain := mergeDecayStageTexts(merged, "some current text to redact", 2, 7); changedAgain {
		t.Fatal("a fully-filled merge must report no change")
	}
}
