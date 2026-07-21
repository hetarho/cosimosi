package memory

import (
	"context"
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
		ID:                     id,
		DiaryID:                "diary-" + id,
		Name:                   "memory " + id,
		CurrentText:            "I walked to the harbor and watched the boats until sunset came.",
		Seed:                   &seed,
		Emotion:                Emotion{Mood: MoodNeutral, Arousal: 0},
		CreatedUniverseTime:    created,
		SemanticStages:         fullStages(),
		RepresentationRevision: 1,
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
	pendings        []PendingGistRise
	watermark       *time.Time
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

func (f *fakeConsolidateTx) LockGraphMutation(context.Context, platform.UserScope) error {
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

func (f *fakeConsolidateTx) ConsolidationWatermarkForUpdate(context.Context, platform.UserScope) (*time.Time, error) {
	return f.watermark, nil
}

func (f *fakeConsolidateTx) SetConsolidationWatermark(_ context.Context, _ platform.UserScope, through time.Time) error {
	// Mirror the store's GREATEST guard: monotone, never rewound.
	if f.watermark == nil || through.After(*f.watermark) {
		f.watermark = &through
	}
	return nil
}

func (f *fakeConsolidateTx) RecordPendingGistRises(_ context.Context, _ platform.UserScope, rises []PendingGistRise) error {
	f.pendings = append(f.pendings, rises...)
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

// applyPersistedState folds the recorded stage advances, pending rises, and decay fills back
// into the fake's memories, simulating what the committed transaction leaves for a later
// advance to read. The watermark persists on the fake itself (it is read at the next run's
// start, like the committed universe_state row).
func (f *fakeConsolidateTx) applyPersistedState() {
	for _, advance := range f.advances {
		for i := range f.memories {
			if f.memories[i].ID != advance.MemoryID {
				continue
			}
			if advance.Stage > f.memories[i].SemanticStage {
				f.memories[i].SemanticStage = advance.Stage
			}
			anchor := advance.TimerResetAt
			f.memories[i].SemanticizeTimerResetAt = &anchor
		}
	}
	for _, pending := range f.pendings {
		for i := range f.memories {
			if f.memories[i].ID != pending.MemoryID {
				continue
			}
			// Mirror the store: GREATEST on the stage, first crossing's rise time kept.
			if f.memories[i].PendingSemanticStage == nil || pending.Stage > *f.memories[i].PendingSemanticStage {
				stage := pending.Stage
				f.memories[i].PendingSemanticStage = &stage
			}
			if f.memories[i].PendingSemanticRiseAt == nil {
				riseAt := pending.RiseAt
				f.memories[i].PendingSemanticRiseAt = &riseAt
			}
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
	f.pendings = nil
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

	if tx.listCalls != 0 || len(tx.advances) != 0 || len(tx.provenance) != 0 || len(tx.pendings) != 0 ||
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
func (progressionOnlyTx) LockGraphMutation(context.Context, platform.UserScope) error { return nil }
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
		if entry.SemanticStage == nil || int(*entry.SemanticStage) != i+1 {
			t.Fatalf("provenance[%d] stage identity = %v, want %d", i, entry.SemanticStage, i+1)
		}
		if !entry.UniverseTime.Equal(to) {
			t.Fatalf("provenance[%d] universe time = %v, want %v", i, entry.UniverseTime, to)
		}
	}
	// All stage texts exist, so nothing defers and no semanticize regen is needed.
	if len(tx.pendings) != 0 {
		t.Fatalf("pendings = %+v, want none for a fully pregenerated ladder", tx.pendings)
	}
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
	tx.synapses = []fakeSynapseRow{{id: "s1", strength: 0.5, lastActivated: consolidateDate(0)}}
	from := consolidateDate(0)
	to := consolidateDate(35)

	runConsolidator(t, tx, &from, to)
	if len(tx.advances) != 1 || tx.advances[0].Stage != 3 || len(tx.decayFills["m1"]) == 0 {
		t.Fatalf("first run advances = %+v fills = %+v", tx.advances, tx.decayFills)
	}
	if tx.downscaleCalls != 1 {
		t.Fatalf("first run downscale batches = %d, want 1", tx.downscaleCalls)
	}
	firstFill := tx.decayFills["m1"]
	firstStrength := tx.synapses[0].strength
	tx.applyPersistedState()

	// The watermark makes a re-run of the very same interval a total no-op: no stage,
	// no provenance, no fill, no job — and, critically, no second downscale (A10/A4).
	runConsolidator(t, tx, &from, to)
	if len(tx.advances) != 0 || len(tx.provenance) != 0 || len(tx.jobs) != 0 {
		t.Fatalf("re-run advanced again: advances=%+v provenance=%d jobs=%d", tx.advances, len(tx.provenance), len(tx.jobs))
	}
	if tx.downscaleCalls != 0 || tx.synapses[0].strength != firstStrength {
		t.Fatalf("re-run downscaled again: calls=%d strength %v → %v", tx.downscaleCalls, firstStrength, tx.synapses[0].strength)
	}
	if len(tx.decayFills) != 0 {
		t.Fatalf("re-run rewrote decay stages: %+v", tx.decayFills)
	}
	if got := tx.memories[0].DecayStages; len(got) != len(firstFill) {
		t.Fatalf("decay stages changed across re-run: %v vs %v", got, firstFill)
	}
}

func TestConsolidateWatermarkClampsOverlappingIntervalToUnprocessedSuffix(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	// At the ceiling: only the downscale distinguishes the runs.
	settled := plainConsolidateMemory("m1", consolidateDate(0))
	settled.SemanticStage = 4
	tx.memories = []EpisodicMemory{settled}
	tx.synapses = []fakeSynapseRow{{id: "s1", strength: 0.5, lastActivated: consolidateDate(0)}}

	from := consolidateDate(0)
	runConsolidator(t, tx, &from, consolidateDate(10))
	if tx.downscaleCalls != 1 {
		t.Fatalf("first run downscale batches = %d, want 1", tx.downscaleCalls)
	}
	afterFirst := tx.synapses[0].strength
	tx.applyPersistedState()

	// An overlapping invocation (from before the watermark) processes only the suffix:
	// one further downscale for (10, 15], never a re-run of the covered (0, 10].
	runConsolidator(t, tx, &from, consolidateDate(15))
	if tx.downscaleCalls != 1 {
		t.Fatalf("overlap downscale batches = %d, want exactly the suffix's 1", tx.downscaleCalls)
	}
	if want := Downscale(afterFirst, values.ConsolidationDownscaleFactor); tx.synapses[0].strength != want {
		t.Fatalf("overlap strength = %v, want one further downscale %v", tx.synapses[0].strength, want)
	}
	if tx.watermark == nil || !tx.watermark.Equal(consolidateDate(15)) {
		t.Fatalf("watermark = %v, want the processed-through end", tx.watermark)
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
	if string(semanticize.Payload) != "{}" {
		t.Fatalf("payload = %s, want source-free object", semanticize.Payload)
	}
	if len(semanticize.Targets) != 1 || semanticize.Targets[0] != (JobTarget{Kind: JobTargetMemory, ID: "m1", ExpectedRevision: 1}) {
		t.Fatalf("targets = %+v, want revisioned m1", semanticize.Targets)
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
	if string(job.Payload) != "{}" {
		t.Fatalf("payload = %s, want source-free object", job.Payload)
	}
	if len(job.Targets) != 1 || job.Targets[0].Kind != JobTargetNeuron || job.Targets[0].ID != "n1" {
		t.Fatalf("targets = %+v, want the replay-set neuron only", job.Targets)
	}
}

func TestConsolidatePartialLadderPublishesReadablePrefixAndDefersTheRest(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	episodicMemory := plainConsolidateMemory("m1", consolidateDate(0))
	// The launch pregeneration landed only stage 1; the crossing to stage 2 finds its text
	// missing, so stage 1 publishes with its real text and stage 2 defers as pending
	// — nothing blank ever enters 변천사 or the visible stage.
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
	if string(semanticize.Payload) != "{}" {
		t.Fatalf("payload = %s, want source-free object", semanticize.Payload)
	}
	if len(semanticize.Targets) != 1 || semanticize.Targets[0].ID != "m1" {
		t.Fatalf("targets = %+v, want m1; current stages are re-read by the worker", semanticize.Targets)
	}
	// The visible rise stops at the readable prefix; the crossed-but-textless stage is
	// pending work, not an empty publication.
	if len(tx.advances) != 1 || tx.advances[0].Stage != 1 {
		t.Fatalf("advances = %+v, want the visible rise clamped to readable stage 1", tx.advances)
	}
	if want := consolidateDate(20); !tx.advances[0].TimerResetAt.Equal(want) {
		t.Fatalf("consumed anchor = %v, want the full crossed span %v", tx.advances[0].TimerResetAt, want)
	}
	if len(tx.pendings) != 1 || tx.pendings[0] != (PendingGistRise{MemoryID: "m1", Stage: 2, RiseAt: to}) {
		t.Fatalf("pendings = %+v, want the deferred rise to stage 2 at %v", tx.pendings, to)
	}
	if len(tx.provenance) != 1 || tx.provenance[0].Text != "gist-1" || tx.provenance[0].SemanticStage == nil || *tx.provenance[0].SemanticStage != 1 {
		t.Fatalf("provenance = %+v, want exactly the readable stage-1 event", tx.provenance)
	}
}

func TestConsolidateWhitespaceRungCountsAsMissingAndDefers(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	episodicMemory := plainConsolidateMemory("m1", consolidateDate(0))
	// A whitespace-only rung would be refused by the provenance blank-text guard, so
	// publishing it readable would abort the whole advance — it must defer instead.
	episodicMemory.SemanticStages = &SemanticStages{"   ", "gist-2", "gist-3", "gist-4"}
	tx.memories = []EpisodicMemory{episodicMemory}
	from := consolidateDate(0)
	to := consolidateDate(24)

	runConsolidator(t, tx, &from, to)

	if len(tx.provenance) != 0 {
		t.Fatalf("provenance = %+v, want none for a whitespace rung", tx.provenance)
	}
	if len(tx.advances) != 1 || tx.advances[0].Stage != 0 {
		t.Fatalf("advances = %+v, want the anchor-only advance at stage 0", tx.advances)
	}
	if len(tx.pendings) != 1 || tx.pendings[0].Stage != 2 {
		t.Fatalf("pendings = %+v, want the deferred rise to stage 2", tx.pendings)
	}
}

func TestConsolidateMissingLadderDefersWholeRiseWithoutBlankHistory(t *testing.T) {
	t.Parallel()
	tx := newFakeConsolidateTx()
	bare := plainConsolidateMemory("m1", consolidateDate(0))
	bare.SemanticStages = nil
	tx.memories = []EpisodicMemory{bare}
	tx.memberNeurons["m1"] = []ExistingNeuron{{ID: "n1", Name: "harbor", Type: NeuronTypeSemantic}}
	from := consolidateDate(0)
	to := consolidateDate(24)

	runConsolidator(t, tx, &from, to)

	// No 변천사 row and no visible stage change — the prior readable stage (0) stays
	// authoritative; the crossing is recorded as revision-bound pending work (A1).
	if len(tx.provenance) != 0 {
		t.Fatalf("provenance = %+v, want none until real text exists", tx.provenance)
	}
	if len(tx.advances) != 1 || tx.advances[0].Stage != 0 {
		t.Fatalf("advances = %+v, want the anchor-only advance at stage 0", tx.advances)
	}
	if want := consolidateDate(20); !tx.advances[0].TimerResetAt.Equal(want) {
		t.Fatalf("consumed anchor = %v, want %v", tx.advances[0].TimerResetAt, want)
	}
	if len(tx.pendings) != 1 || tx.pendings[0] != (PendingGistRise{MemoryID: "m1", Stage: 2, RiseAt: to}) {
		t.Fatalf("pendings = %+v, want the deferred rise to stage 2", tx.pendings)
	}
	var semanticize *Job
	for i := range tx.jobs {
		if tx.jobs[i].Kind == JobKindSemanticize {
			semanticize = &tx.jobs[i]
		}
	}
	if semanticize == nil {
		t.Fatal("deferred rise did not enqueue regeneration")
	}
	if semanticize.Targets[0].ExpectedRevision != 1 {
		t.Fatalf("regen revision = %d, want the live revision fence", semanticize.Targets[0].ExpectedRevision)
	}

	// A later crossing extends the pending target and keeps re-enqueueing, but the first
	// crossing's universe-time is preserved as the eventual event time.
	tx.applyPersistedState()
	day24 := consolidateDate(24)
	runConsolidator(t, tx, &day24, consolidateDate(34))
	if len(tx.provenance) != 0 {
		t.Fatalf("extension appended history: %+v", tx.provenance)
	}
	if len(tx.pendings) != 1 || tx.pendings[0].Stage != 3 || !tx.pendings[0].RiseAt.Equal(consolidateDate(34)) {
		t.Fatalf("pendings = %+v, want the extension to stage 3", tx.pendings)
	}
	tx.applyPersistedState()
	if tx.memories[0].PendingSemanticStage == nil || *tx.memories[0].PendingSemanticStage != 3 {
		t.Fatalf("persisted pending stage = %v, want 3", tx.memories[0].PendingSemanticStage)
	}
	if tx.memories[0].PendingSemanticRiseAt == nil || !tx.memories[0].PendingSemanticRiseAt.Equal(to) {
		t.Fatalf("persisted rise time = %v, want the FIRST crossing %v kept", tx.memories[0].PendingSemanticRiseAt, to)
	}

	// With no new units crossed, a pending memory still re-enqueues its regeneration on
	// every advance — a dead job must not defer the rise forever.
	day34 := consolidateDate(34)
	runConsolidator(t, tx, &day34, consolidateDate(36))
	regens := 0
	for _, job := range tx.jobs {
		if job.Kind == JobKindSemanticize {
			regens++
		}
	}
	if regens != 1 {
		t.Fatalf("regens on a quiet advance = %d, want the repair re-enqueue", regens)
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
