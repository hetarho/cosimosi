package memory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// fakeLaunchStore implements LaunchRepo + LaunchTx: writes stage into a scratch
// state that only becomes visible (committed) when fn returns nil — mirroring the
// all-or-nothing transaction contract the tests assert.
type fakeLaunchStore struct {
	clock          *time.Time
	latestLaunched *time.Time
	existing       []ExistingNeuron
	failMethod     string

	// Link seam fixtures (plan 21): prior memberships CoActivations replays and the
	// stored base strengths SynapseStrengths serves on the repeat path.
	coActivations    []NeuronMemoryActivation
	existingSynapses map[string]float64

	txCount   int
	committed launchState
	staging   *launchState

	// Recall seam fixtures (job 44): the memory/members/neighbors/diary-memberships the
	// recall reads replay, plus a recorder of the recall-specific writes committed only
	// when the recall transaction returns nil (the same all-or-nothing contract).
	recallStars          map[string]EpisodicMemory
	recallMemberNeurons  map[string][]ExistingNeuron
	recallMemberSynapses map[string][]Synapse
	recallNeighbors      map[string][]NeighborSharedSemanticCount
	diaryMemories        map[string][]string

	recallTxCount int
	recall        recallRecord
	recallStaging *recallRecord
}

type recallRecord struct {
	anchorResets []recordedAnchorReset
	offsets      []recordedOffset
	provenance   []MemoryProvenance
	reconText    []recordedReconText
}

type recordedAnchorReset struct {
	memoryID     string
	universeTime time.Time
}

type recordedOffset struct {
	memoryIDs []string
	delta     float64
}

type recordedReconText struct {
	memoryID    string
	currentText string
	seed        int64
}

type launchState struct {
	diaries      []Diary
	memories     []EpisodicMemory
	neurons      []Neuron
	activations  []NeuronActivation
	synapses     []Synapse
	jobs         []Job
	findCalls    [][]string
	clockAdvance *time.Time
}

var errInjectedFailure = errors.New("injected persistence failure")

func (f *fakeLaunchStore) InLaunchTx(_ context.Context, fn func(tx LaunchTx) error) error {
	f.txCount++
	f.staging = &launchState{}
	if err := fn(f); err != nil {
		f.staging = nil
		return err
	}
	f.committed = *f.staging
	if f.staging.clockAdvance != nil {
		f.clock = f.staging.clockAdvance
	}
	f.staging = nil
	return nil
}

func (f *fakeLaunchStore) fail(method string) error {
	if f.failMethod == method {
		return errInjectedFailure
	}
	return nil
}

func (f *fakeLaunchStore) UniverseClock(_ context.Context, scope platform.UserScope) (*time.Time, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	if err := f.fail("UniverseClock"); err != nil {
		return nil, err
	}
	if f.staging != nil && f.staging.clockAdvance != nil {
		return f.staging.clockAdvance, nil
	}
	return f.clock, nil
}

func (f *fakeLaunchStore) LockUniverseClock(_ context.Context, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	return f.fail("LockUniverseClock")
}

func (f *fakeLaunchStore) UniverseClockForUpdate(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := f.fail("UniverseClockForUpdate"); err != nil {
		return nil, err
	}
	return f.UniverseClock(ctx, scope)
}

func (f *fakeLaunchStore) LatestLaunchedUniverseTime(_ context.Context, scope platform.UserScope) (*time.Time, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	if err := f.fail("LatestLaunchedUniverseTime"); err != nil {
		return nil, err
	}
	return f.latestLaunched, nil
}

// AdvanceUniverseClock mirrors the real store's GREATEST semantics via the
// domain AdvanceClock, staging the value so a rolled-back transaction leaves
// the committed clock untouched — the atomicity the tests assert. It reads
// the staged advance first so a double in-tx advance behaves like the real
// GREATEST-against-current-row upsert.
func (f *fakeLaunchStore) AdvanceUniverseClock(_ context.Context, scope platform.UserScope, target time.Time) (time.Time, error) {
	if scope.UserID() == "" {
		return time.Time{}, errors.New("scope missing")
	}
	if err := f.fail("AdvanceUniverseClock"); err != nil {
		return time.Time{}, err
	}
	current := time.Time{}
	if f.staging != nil && f.staging.clockAdvance != nil {
		current = *f.staging.clockAdvance
	} else if f.clock != nil {
		current = *f.clock
	}
	advanced := AdvanceClock(current, target)
	f.staging.clockAdvance = &advanced
	return advanced, nil
}

func (f *fakeLaunchStore) InsertDiary(_ context.Context, _ platform.UserScope, diary Diary) (Diary, error) {
	if err := f.fail("InsertDiary"); err != nil {
		return Diary{}, err
	}
	f.staging.diaries = append(f.staging.diaries, diary)
	return diary, nil
}

func (f *fakeLaunchStore) InsertEpisodicMemory(_ context.Context, _ platform.UserScope, episodicMemory EpisodicMemory) (EpisodicMemory, error) {
	if err := f.fail("InsertEpisodicMemory"); err != nil {
		return EpisodicMemory{}, err
	}
	f.staging.memories = append(f.staging.memories, episodicMemory)
	return episodicMemory, nil
}

func (f *fakeLaunchStore) FindNeuronsByNames(_ context.Context, _ platform.UserScope, names []string) ([]ExistingNeuron, error) {
	f.staging.findCalls = append(f.staging.findCalls, append([]string(nil), names...))
	if err := f.fail("FindNeuronsByNames"); err != nil {
		return nil, err
	}
	matched := make([]ExistingNeuron, 0)
	for _, neuron := range f.existing {
		for _, name := range names {
			if strings.EqualFold(neuron.Name, name) {
				matched = append(matched, neuron)
			}
		}
	}
	return matched, nil
}

func (f *fakeLaunchStore) UpsertNeuron(_ context.Context, _ platform.UserScope, neuron Neuron) (Neuron, error) {
	if err := f.fail("UpsertNeuron"); err != nil {
		return Neuron{}, err
	}
	f.staging.neurons = append(f.staging.neurons, neuron)
	return neuron, nil
}

func (f *fakeLaunchStore) InsertNeuronActivation(_ context.Context, _ platform.UserScope, activation NeuronActivation) (NeuronActivation, error) {
	if err := f.fail("InsertNeuronActivation"); err != nil {
		return NeuronActivation{}, err
	}
	f.staging.activations = append(f.staging.activations, activation)
	return activation, nil
}

func (f *fakeLaunchStore) EnqueueJob(_ context.Context, _ platform.UserScope, job Job) (Job, error) {
	if err := f.fail("EnqueueJob"); err != nil {
		return Job{}, err
	}
	f.staging.jobs = append(f.staging.jobs, job)
	return job, nil
}

func (f *fakeLaunchStore) CoActivations(_ context.Context, scope platform.UserScope, neuronIDs []string) ([]NeuronMemoryActivation, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	if err := f.fail("CoActivations"); err != nil {
		return nil, err
	}
	requested := make(map[string]struct{}, len(neuronIDs))
	for _, id := range neuronIDs {
		requested[id] = struct{}{}
	}
	matched := make([]NeuronMemoryActivation, 0)
	for _, activation := range f.coActivations {
		if _, ok := requested[activation.NeuronID]; ok {
			matched = append(matched, activation)
		}
	}
	return matched, nil
}

func (f *fakeLaunchStore) SynapseStrengths(_ context.Context, scope platform.UserScope, neuronIDs []string) ([]NeuronPairStrength, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	if err := f.fail("SynapseStrengths"); err != nil {
		return nil, err
	}
	requested := make(map[string]struct{}, len(neuronIDs))
	for _, id := range neuronIDs {
		requested[id] = struct{}{}
	}
	strengths := make([]NeuronPairStrength, 0)
	for key, strength := range f.existingSynapses {
		aID, bID := splitSynapseKey(key)
		if _, ok := requested[aID]; !ok {
			continue
		}
		if _, ok := requested[bID]; !ok {
			continue
		}
		strengths = append(strengths, NeuronPairStrength{NeuronAID: aID, NeuronBID: bID, Strength: strength})
	}
	return strengths, nil
}

func (f *fakeLaunchStore) UpsertSynapse(_ context.Context, scope platform.UserScope, synapse Synapse) (Synapse, error) {
	if scope.UserID() == "" {
		return Synapse{}, errors.New("scope missing")
	}
	if err := f.fail("UpsertSynapse"); err != nil {
		return Synapse{}, err
	}
	if synapse.NeuronBID < synapse.NeuronAID {
		synapse.NeuronAID, synapse.NeuronBID = synapse.NeuronBID, synapse.NeuronAID
	}
	f.staging.synapses = append(f.staging.synapses, synapse)
	return synapse, nil
}

func synapseKey(a string, b string) string {
	if b < a {
		a, b = b, a
	}
	return a + "\x00" + b
}

func splitSynapseKey(key string) (string, string) {
	i := strings.IndexByte(key, 0)
	return key[:i], key[i+1:]
}

type fakeLinker struct {
	calls    int
	launched []LaunchedMemory
	err      error
}

func (f *fakeLinker) LinkLaunched(_ context.Context, _ platform.UserScope, _ LaunchTx, launched []LaunchedMemory) error {
	f.calls++
	f.launched = append([]LaunchedMemory(nil), launched...)
	return f.err
}

// fakeProgression records every OnAdvance and whether it fired inside the
// launch store's open transaction (staging non-nil) — the [T4] in-tx contract.
type fakeProgression struct {
	store *fakeLaunchStore
	calls []progressionCall
	err   error
}

type progressionCall struct {
	from     *time.Time
	to       time.Time
	insideTx bool
}

func (f *fakeProgression) OnAdvance(_ context.Context, scope platform.UserScope, _ ProgressionTx, from *time.Time, to time.Time) error {
	if scope.UserID() == "" {
		return errors.New("scope missing")
	}
	f.calls = append(f.calls, progressionCall{
		from:     from,
		to:       to,
		insideTx: f.store != nil && f.store.staging != nil,
	})
	return f.err
}

func confirmedFixture() []ExtractedMemory {
	return []ExtractedMemory{
		{
			Name: "Morning market run",
			Mood: MoodJoy,
			Neurons: []ExtractedNeuron{
				{Name: "grocery shopping", Type: NeuronTypeSemantic},
				{Name: "Market", Type: NeuronTypeSpatial},
			},
		},
		{
			Name: "Lunch with Mina",
			Mood: MoodCalm,
			Neurons: []ExtractedNeuron{
				{Name: "catching up", Type: NeuronTypeSemantic},
				{Name: "market", Type: NeuronTypeSpatial},
				{Name: "Mina", Type: NeuronTypeEntity},
			},
		},
	}
}

func TestPersistEncodedLaunchesAtomicallyWithDedup(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// "mina" already exists for this user: the extractor canonicalized onto it,
	// so persist must reference the existing id, not create a duplicate row.
	fixture.launches.existing = []ExistingNeuron{{ID: "existing-mina", Name: "Mina", Type: NeuronTypeEntity}}

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	state := fixture.launches.committed

	if len(state.diaries) != 1 {
		t.Fatalf("diaries = %d, want exactly one append-only insert", len(state.diaries))
	}
	if len(result.MemoryIDs) != 2 || len(state.memories) != 2 {
		t.Fatalf("memories = %d/%d, want 2", len(result.MemoryIDs), len(state.memories))
	}
	// 4 distinct (name, type) keys, one deduped onto existing-mina → 3 created.
	if len(state.neurons) != 3 {
		t.Fatalf("created neurons = %d, want 3 (mina deduped)", len(state.neurons))
	}
	if len(result.NewNeuronIDs) != 3 {
		t.Fatalf("new neuron ids = %d, want only the genuinely created 3", len(result.NewNeuronIDs))
	}
	for _, id := range result.NewNeuronIDs {
		if id == "existing-mina" {
			t.Fatal("a deduped neuron leaked into new_neuron_ids")
		}
	}
	// "Market"/"market" share one key → one shared neuron activated by both memories.
	if len(state.activations) != 5 {
		t.Fatalf("activations = %d, want 5", len(state.activations))
	}
	for _, activation := range state.activations {
		if activation.Weight != 1.0 {
			t.Fatalf("activation weight = %v, want the uniform 1.0", activation.Weight)
		}
	}
	usedMina := false
	for _, activation := range state.activations {
		if activation.NeuronID == "existing-mina" {
			usedMina = true
		}
	}
	if !usedMina {
		t.Fatal("the deduped neuron id was not referenced by any activation")
	}

	for _, episodicMemory := range state.memories {
		if episodicMemory.Seed == nil {
			t.Fatal("seed missing")
		}
		if !episodicMemory.CreatedUniverseTime.Equal(testDiaryDate()) {
			t.Fatal("created_universe_time must equal diary_date")
		}
		expected := ArousalToInitialStrength(episodicMemory.Emotion.Arousal)
		if episodicMemory.BaseStrength != expected {
			t.Fatalf("base strength = %v, want arousal-modulated %v", episodicMemory.BaseStrength, expected)
		}
	}

	kinds := map[JobKind]int{}
	for _, job := range state.jobs {
		kinds[job.Kind]++
	}
	if kinds[JobKindEmbed] != 1 || kinds[JobKindSemanticize] != 2 {
		t.Fatalf("jobs = %v, want 1 embed + 2 semanticize", kinds)
	}
	for _, job := range state.jobs {
		if job.Kind != JobKindEmbed {
			continue
		}
		var payload EmbedJobPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			t.Fatalf("embed payload invalid: %v", err)
		}
		if len(payload.Neurons) != 3 {
			t.Fatalf("embed payload neurons = %d, want only the 3 new ones", len(payload.Neurons))
		}
	}
	if fixture.linker.calls != 1 {
		t.Fatalf("link seam calls = %d, want 1 (inside the transaction)", fixture.linker.calls)
	}
	if len(fixture.linker.launched) != 2 {
		t.Fatalf("link seam received %d memories, want 2", len(fixture.linker.launched))
	}
}

func TestPersistEncodedMidStepFailureLeavesNoPartialRows(t *testing.T) {
	t.Parallel()
	for _, method := range []string{"InsertEpisodicMemory", "UpsertNeuron", "InsertNeuronActivation", "EnqueueJob"} {
		fixture := newFixture(t)
		fixture.launches.failMethod = method
		_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
		if !errors.Is(err, errInjectedFailure) {
			t.Fatalf("failMethod=%s err = %v, want the injected failure", method, err)
		}
		state := fixture.launches.committed
		if len(state.diaries)+len(state.memories)+len(state.neurons)+len(state.activations)+len(state.jobs) != 0 {
			t.Fatalf("failMethod=%s left partial rows: %+v", method, state)
		}
	}
}

func TestPersistEncodedPastDatedSavesDiaryLaunchesNothing(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	clock := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &clock

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	if !result.PastDated {
		t.Fatal("PastDated = false, want the monotonic guard to trip")
	}
	state := fixture.launches.committed
	if len(state.diaries) != 1 {
		t.Fatalf("diaries = %d, want 1 — a past-dated diary is still saved", len(state.diaries))
	}
	if len(result.MemoryIDs) != 0 || len(state.memories) != 0 || len(state.activations) != 0 || len(state.neurons) != 0 || len(state.jobs) != 0 {
		t.Fatal("a past-dated diary must launch no episodic memory, create no neuron, and enqueue no job")
	}
	if fixture.linker.calls != 0 {
		t.Fatal("the link seam must not run for a past-dated diary")
	}
	// The clock stays unmoved and the response interval is {clock, clock}.
	if state.clockAdvance != nil {
		t.Fatal("a past-dated launch must not advance the clock")
	}
	if result.PreviousUniverseTime == nil || !result.PreviousUniverseTime.Equal(clock) ||
		result.UniverseTime == nil || !result.UniverseTime.Equal(clock) {
		t.Fatalf("interval = {%v, %v}, want the unmoved clock in both", result.PreviousUniverseTime, result.UniverseTime)
	}
	if len(fixture.progression.calls) != 0 {
		t.Fatal("the progression hook must not fire when the clock does not advance")
	}
}

func TestPersistEncodedSameDateLaunches(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	clock := testDiaryDate()
	fixture.launches.clock = &clock

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	if result.PastDated || len(result.MemoryIDs) != 2 {
		t.Fatalf("same-date launch must proceed, got pastDated=%v memories=%d", result.PastDated, len(result.MemoryIDs))
	}
	// The clock did not move, so no interval crossed and no hook fires.
	if len(fixture.progression.calls) != 0 {
		t.Fatalf("progression calls = %d, want 0 for an equal-date launch", len(fixture.progression.calls))
	}
}

func TestPersistEncodedPreClockUniverseGuardsAgainstLatestLaunched(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// A universe launched before the clock existed: no universe_state row, but
	// memories up to 2026-07-02. The guard must use the latest launched date,
	// not treat the unborn clock as "anything goes" — otherwise a past-dated
	// launch would birth the clock in the past and visibly rewind the universe.
	latest := testDiaryDate()
	fixture.launches.latestLaunched = &latest
	pastDate := latest.AddDate(0, 0, -10)

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", pastDate, confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	if !result.PastDated {
		t.Fatal("PastDated = false, want the unborn-clock guard to use the latest launched date")
	}
	if fixture.launches.clock != nil {
		t.Fatalf("clock = %v, want still unborn after a refused launch", fixture.launches.clock)
	}
	if result.PreviousUniverseTime == nil || !result.PreviousUniverseTime.Equal(latest) {
		t.Fatalf("interval baseline = %v, want the latest launched %v", result.PreviousUniverseTime, latest)
	}
}

func TestPersistEncodedAdvancesClockAndReturnsInterval(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &previous

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(testDiaryDate()) {
		t.Fatalf("committed clock = %v, want the diary date %v", fixture.launches.clock, testDiaryDate())
	}
	if result.PreviousUniverseTime == nil || !result.PreviousUniverseTime.Equal(previous) {
		t.Fatalf("previous = %v, want %v", result.PreviousUniverseTime, previous)
	}
	if result.UniverseTime == nil || !result.UniverseTime.Equal(testDiaryDate()) {
		t.Fatalf("universe time = %v, want %v", result.UniverseTime, testDiaryDate())
	}
	if len(fixture.progression.calls) != 1 {
		t.Fatalf("progression calls = %d, want 1 per advance", len(fixture.progression.calls))
	}
	call := fixture.progression.calls[0]
	if call.from == nil || !call.from.Equal(previous) || !call.to.Equal(testDiaryDate()) {
		t.Fatalf("hook interval = {%v, %v}, want {%v, %v}", call.from, call.to, previous, testDiaryDate())
	}
	if !call.insideTx {
		t.Fatal("the progression hook must fire inside the launch transaction")
	}
}

func TestPersistEncodedFirstLaunchBirthsClockWithNilPrevious(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)

	result, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	if result.PastDated {
		t.Fatal("the first-ever launch must be launchable (no prior bar)")
	}
	if result.PreviousUniverseTime != nil {
		t.Fatalf("previous = %v, want nil on the first-ever launch", result.PreviousUniverseTime)
	}
	if result.UniverseTime == nil || !result.UniverseTime.Equal(testDiaryDate()) {
		t.Fatalf("universe time = %v, want %v", result.UniverseTime, testDiaryDate())
	}
	if len(fixture.progression.calls) != 1 || fixture.progression.calls[0].from != nil {
		t.Fatalf("hook = %+v, want one call with nil from", fixture.progression.calls)
	}
}

func TestPersistEncodedClockAdvanceFailureRollsBackLaunch(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.launches.failMethod = "AdvanceUniverseClock"

	_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if !errors.Is(err, errInjectedFailure) {
		t.Fatalf("err = %v, want the injected failure", err)
	}
	state := fixture.launches.committed
	if len(state.diaries)+len(state.memories)+len(state.jobs) != 0 || fixture.launches.clock != nil {
		t.Fatal("a failed clock advance must roll the whole launch back")
	}
}

func TestPersistEncodedProgressionFailureRollsBackLaunch(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.progression.err = errors.New("progression handler failed")

	_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err == nil {
		t.Fatal("a progression failure inside the transaction must fail the launch")
	}
	state := fixture.launches.committed
	if len(state.diaries)+len(state.memories) != 0 || fixture.launches.clock != nil {
		t.Fatal("a failed progression hook must roll back the launch and the advance")
	}
}

func TestPersistEncodedRejectsInvalidConfirmedSplit(t *testing.T) {
	t.Parallel()
	tooFew := confirmedFixture()[:1]
	noSemantic := confirmedFixture()
	noSemantic[0].Neurons = []ExtractedNeuron{{Name: "Market", Type: NeuronTypeSpatial}}
	badMood := confirmedFixture()
	badMood[0].Mood = Mood("SPARKLY")
	badType := confirmedFixture()
	badType[0].Neurons[0].Type = NeuronType("time")

	cases := map[string][]ExtractedMemory{
		"count below minimum":     tooFew,
		"missing semantic neuron": noSemantic,
		"unknown mood":            badMood,
		"invalid neuron type":     badType,
	}
	for name, confirmed := range cases {
		fixture := newFixture(t)
		_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmed)
		if !errors.Is(err, ErrLaunchInvalidMemories) {
			t.Fatalf("%s: err = %v, want ErrLaunchInvalidMemories", name, err)
		}
		if fixture.launches.txCount != 0 {
			t.Fatalf("%s: invalid input must be rejected before the transaction", name)
		}
	}
}

func TestPersistEncodedRejectsFutureDatedDiary(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	// Fixture "now" is 2026-07-02; +1 day of timezone slack allows 2026-07-03,
	// so 2026-07-04 must be rejected before it can poison the monotonic clock.
	future := time.Date(2026, 7, 4, 0, 0, 0, 0, time.UTC)
	_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", future, confirmedFixture())
	if !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("future date err = %v, want ErrEncodeInputRequired", err)
	}
	if fixture.launches.txCount != 0 {
		t.Fatal("a future-dated launch must be rejected before the transaction")
	}

	allowed := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	if _, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", allowed, confirmedFixture()); err != nil {
		t.Fatalf("date within timezone slack must launch, got: %v", err)
	}
}

func TestPersistEncodedRequiresScopeAndInput(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.service.PersistEncoded(context.Background(), platform.UserScope{}, "body", testDiaryDate(), confirmedFixture()); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("missing scope err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.PersistEncoded(context.Background(), testScope(t), " ", testDiaryDate(), confirmedFixture()); !errors.Is(err, ErrEncodeInputRequired) {
		t.Fatalf("empty body err = %v, want ErrEncodeInputRequired", err)
	}
}

func TestPersistEncodedLinkSeamFailureAbortsTheLaunch(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.linker.err = errors.New("link failed")
	_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmedFixture())
	if err == nil {
		t.Fatal("a link failure inside the transaction must fail the launch")
	}
	state := fixture.launches.committed
	if len(state.diaries) != 0 || len(state.memories) != 0 {
		t.Fatal("a failed link must roll back the whole launch")
	}
}

func TestUniverseReadsStoredClockWithFallback(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	older := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	stored := time.Date(2026, 7, 6, 0, 0, 0, 0, time.UTC)

	// The stored universe_state clock wins when present — a recall-synced clock
	// can sit past every memory's creation date.
	fixture.universe.facts = UniverseFacts{
		EpisodicMemories: []EpisodicMemory{
			{ID: "m-1", CreatedUniverseTime: newer},
			{ID: "m-2", CreatedUniverseTime: older},
		},
		UniverseClock: &stored,
	}
	_, universeTime, err := fixture.service.Universe(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("Universe failed: %v", err)
	}
	if universeTime == nil || !universeTime.Equal(stored) {
		t.Fatalf("universe time = %v, want the stored clock %v", universeTime, stored)
	}

	// One-release fallback: an unborn clock row still derives the pre-Epic-B
	// max(created_universe_time), so no universe visibly resets.
	fixture.universe.facts = UniverseFacts{EpisodicMemories: []EpisodicMemory{
		{ID: "m-1", CreatedUniverseTime: newer},
		{ID: "m-2", CreatedUniverseTime: older},
	}}
	_, universeTime, err = fixture.service.Universe(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("Universe failed: %v", err)
	}
	if universeTime == nil || !universeTime.Equal(newer) {
		t.Fatalf("fallback universe time = %v, want %v", universeTime, newer)
	}

	fixture.universe.facts = UniverseFacts{}
	_, universeTime, err = fixture.service.Universe(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("Universe failed: %v", err)
	}
	if universeTime != nil {
		t.Fatalf("universe time = %v, want nil before the first launch", universeTime)
	}
}

func TestPersistEncodedDuplicateNeuronInOneMemoryActivatesOnce(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	confirmed := confirmedFixture()
	confirmed[0].Neurons = append(confirmed[0].Neurons, ExtractedNeuron{Name: "grocery shopping", Type: NeuronTypeSemantic})

	_, err := fixture.service.PersistEncoded(context.Background(), testScope(t), "diary body", testDiaryDate(), confirmed)
	if err != nil {
		t.Fatalf("PersistEncoded failed: %v", err)
	}
	seen := map[string]struct{}{}
	for _, activation := range fixture.launches.committed.activations {
		key := fmt.Sprintf("%s|%s", activation.EpisodicMemoryID, activation.NeuronID)
		if _, dup := seen[key]; dup {
			t.Fatalf("duplicate activation for %s", key)
		}
		seen[key] = struct{}{}
	}
}
