package memory

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// --- fakes ---------------------------------------------------------------------------------------

type fakeSealSuggester struct {
	calls   int
	suggest func(summary MemorySummary, words string, candidates []SealCandidateRef) (SealSuggestion, error)
}

func (f *fakeSealSuggester) Suggest(_ context.Context, summary MemorySummary, words string, candidates []SealCandidateRef) (SealSuggestion, error) {
	f.calls++
	if f.suggest != nil {
		return f.suggest(summary, words, candidates)
	}
	// Default: surface every offered candidate unchanged (a safe subset by construction).
	out := make([]SealCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		out = append(out, SealCandidate{NeuronID: candidate.NeuronID, Reason: "held only here"})
	}
	return SealSuggestion{Candidates: out}, nil
}

type fakeRelMemory struct {
	diaryID string
	name    string
	text    string
	mood    Mood
	deleted bool
}

type fakeRelNeuron struct {
	semantic bool
	sealed   bool
	revision int64
}

type fakeRelActivation struct {
	memoryID string
	neuronID string
}

type fakeRelSynapse struct {
	aID      string
	bID      string
	strength float64
}

type fakeRelGroup struct {
	id        string
	diaryID   string
	deletedAt time.Time
	memoryIDs []string
	sealed    []string
	deltas    []SynapseDelta
}

// fakeReleaseRepo is a compact in-memory model of the release state. It implements both ReleaseRepo
// and ReleaseTx so InReleaseTx runs fn against itself, with a snapshot restore on error so an aborted
// transaction leaves no partial write (the double-release no-double-seal guarantee).
type fakeReleaseRepo struct {
	memories    map[string]*fakeRelMemory
	neurons     map[string]*fakeRelNeuron
	activations []fakeRelActivation
	synapses    map[string]*fakeRelSynapse
	groups      map[string]*fakeRelGroup
	jobs        map[string]*Job
	operations  []string
	nextID      int

	txCount     int
	weakenCalls int
	sweptDiary  bool
}

func newFakeReleaseRepo() *fakeReleaseRepo {
	return &fakeReleaseRepo{
		memories: map[string]*fakeRelMemory{},
		neurons:  map[string]*fakeRelNeuron{},
		synapses: map[string]*fakeRelSynapse{},
		groups:   map[string]*fakeRelGroup{},
		jobs:     map[string]*Job{},
	}
}

func (f *fakeReleaseRepo) InReleaseTx(ctx context.Context, fn func(tx ReleaseTx) error) error {
	f.txCount++
	snapshot := f.snapshot()
	if err := fn(f); err != nil {
		f.restore(snapshot)
		return err
	}
	return nil
}

func (f *fakeReleaseRepo) snapshot() *fakeReleaseRepo {
	clone := newFakeReleaseRepo()
	for id, mem := range f.memories {
		copyMem := *mem
		clone.memories[id] = &copyMem
	}
	for id, neuron := range f.neurons {
		copyNeuron := *neuron
		clone.neurons[id] = &copyNeuron
	}
	for id, synapse := range f.synapses {
		copySynapse := *synapse
		clone.synapses[id] = &copySynapse
	}
	for id, group := range f.groups {
		copyGroup := *group
		copyGroup.memoryIDs = append([]string(nil), group.memoryIDs...)
		copyGroup.sealed = append([]string(nil), group.sealed...)
		copyGroup.deltas = append([]SynapseDelta(nil), group.deltas...)
		clone.groups[id] = &copyGroup
	}
	for id, job := range f.jobs {
		copyJob := *job
		copyJob.Payload = append([]byte(nil), job.Payload...)
		copyJob.Targets = append([]JobTarget(nil), job.Targets...)
		if job.DedupKey != nil {
			value := *job.DedupKey
			copyJob.DedupKey = &value
		}
		if job.TerminalAt != nil {
			value := *job.TerminalAt
			copyJob.TerminalAt = &value
		}
		if job.CanceledByReleaseID != nil {
			value := *job.CanceledByReleaseID
			copyJob.CanceledByReleaseID = &value
		}
		clone.jobs[id] = &copyJob
	}
	clone.activations = append([]fakeRelActivation(nil), f.activations...)
	clone.operations = append([]string(nil), f.operations...)
	clone.nextID = f.nextID
	clone.weakenCalls = f.weakenCalls
	clone.sweptDiary = f.sweptDiary
	return clone
}

func (f *fakeReleaseRepo) restore(snapshot *fakeReleaseRepo) {
	f.memories = snapshot.memories
	f.neurons = snapshot.neurons
	f.synapses = snapshot.synapses
	f.groups = snapshot.groups
	f.jobs = snapshot.jobs
	f.activations = snapshot.activations
	f.operations = snapshot.operations
	f.nextID = snapshot.nextID
	f.weakenCalls = snapshot.weakenCalls
	f.sweptDiary = snapshot.sweptDiary
}

func (f *fakeReleaseRepo) EpisodicMemoryForRelease(_ context.Context, _ platform.UserScope, memoryID string) (EpisodicMemory, error) {
	mem, ok := f.memories[memoryID]
	if !ok {
		return EpisodicMemory{}, ErrReleaseMemoryNotFound
	}
	episodicMemory := EpisodicMemory{
		ID:          memoryID,
		DiaryID:     mem.diaryID,
		Name:        mem.name,
		CurrentText: mem.text,
		Emotion:     Emotion{Mood: mem.mood},
	}
	if mem.deleted {
		deletedAt := time.Unix(0, 0).UTC()
		episodicMemory.DeletedAt = &deletedAt
	}
	return episodicMemory, nil
}

func (f *fakeReleaseRepo) ThisMemoryOnlySemanticNeurons(_ context.Context, _ platform.UserScope, memoryID string) ([]SealCandidateRef, error) {
	out := []SealCandidateRef{}
	for _, neuronID := range f.neuronsActivatedBy(memoryID) {
		neuron := f.neurons[neuronID]
		if neuron == nil || !neuron.semantic || neuron.sealed {
			continue
		}
		if f.activatedByOtherLiveMemory(neuronID, memoryID) {
			continue
		}
		out = append(out, SealCandidateRef{NeuronID: neuronID, Name: neuronID})
	}
	return out, nil
}

func (f *fakeReleaseRepo) ThisMemoryOnlySemanticNeuronIDs(_ context.Context, _ platform.UserScope, memoryID string) ([]string, error) {
	out := []string{}
	for _, neuronID := range f.neuronsActivatedBy(memoryID) {
		neuron := f.neurons[neuronID]
		if neuron == nil || !neuron.semantic {
			continue
		}
		if f.activatedByOtherLiveMemory(neuronID, memoryID) {
			continue
		}
		out = append(out, neuronID)
	}
	return out, nil
}

func (f *fakeReleaseRepo) neuronsActivatedBy(memoryID string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, activation := range f.activations {
		if activation.memoryID == memoryID && !seen[activation.neuronID] {
			seen[activation.neuronID] = true
			out = append(out, activation.neuronID)
		}
	}
	return out
}

func (f *fakeReleaseRepo) activatedByOtherLiveMemory(neuronID, memoryID string) bool {
	for _, activation := range f.activations {
		if activation.neuronID != neuronID || activation.memoryID == memoryID {
			continue
		}
		if mem, ok := f.memories[activation.memoryID]; ok && !mem.deleted {
			return true
		}
	}
	return false
}

func (f *fakeReleaseRepo) SoftDeleteDiaryMemories(_ context.Context, _ platform.UserScope, diaryID string, _ time.Time) ([]string, error) {
	out := []string{}
	for id, mem := range f.memories {
		if mem.diaryID == diaryID && !mem.deleted {
			mem.deleted = true
			out = append(out, id)
		}
	}
	return out, nil
}

func (f *fakeReleaseRepo) RemovalNeuronIDs(_ context.Context, _ platform.UserScope, memoryIDs []string, neuronType *NeuronType) ([]string, error) {
	inSet := map[string]bool{}
	for _, id := range memoryIDs {
		inSet[id] = true
	}
	seen := map[string]bool{}
	out := []string{}
	for _, activation := range f.activations {
		if !inSet[activation.memoryID] || seen[activation.neuronID] {
			continue
		}
		neuron := f.neurons[activation.neuronID]
		if neuron == nil || neuron.sealed {
			continue
		}
		if neuronType != nil && *neuronType == NeuronTypeSemantic && !neuron.semantic {
			continue
		}
		seen[activation.neuronID] = true
		out = append(out, activation.neuronID)
	}
	return out, nil
}

func (f *fakeReleaseRepo) NeuronActivationFacts(_ context.Context, _ platform.UserScope, neuronIDs []string) ([]NeuronActivationFact, error) {
	want := map[string]bool{}
	for _, id := range neuronIDs {
		want[id] = true
	}
	out := []NeuronActivationFact{}
	for _, activation := range f.activations {
		if !want[activation.neuronID] {
			continue
		}
		deleted := false
		if mem, ok := f.memories[activation.memoryID]; ok {
			deleted = mem.deleted
		}
		out = append(out, NeuronActivationFact{
			NeuronID:         activation.neuronID,
			EpisodicMemoryID: activation.memoryID,
			MemoryDeleted:    deleted,
		})
	}
	return out, nil
}

func (f *fakeReleaseRepo) SealNeurons(_ context.Context, _ platform.UserScope, neuronIDs []string, _ time.Time) error {
	for _, id := range neuronIDs {
		if neuron, ok := f.neurons[id]; ok {
			neuron.sealed = true
		}
	}
	return nil
}

func (f *fakeReleaseRepo) contributionSynapses(removalNeuronIDs, sharedNeuronIDs []string) []string {
	inRemoval := map[string]bool{}
	for _, id := range removalNeuronIDs {
		inRemoval[id] = true
	}
	isShared := map[string]bool{}
	for _, id := range sharedNeuronIDs {
		isShared[id] = true
	}
	out := []string{}
	for id, synapse := range f.synapses {
		if inRemoval[synapse.aID] && inRemoval[synapse.bID] && (isShared[synapse.aID] || isShared[synapse.bID]) {
			out = append(out, id)
		}
	}
	return out
}

func (f *fakeReleaseRepo) WeakenSharedContributions(_ context.Context, _ platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) error {
	f.weakenCalls++
	for _, id := range f.contributionSynapses(removalNeuronIDs, sharedNeuronIDs) {
		f.synapses[id].strength = Depress(f.synapses[id].strength, amount)
	}
	return nil
}

func (f *fakeReleaseRepo) WeakenSharedContributionsReturningDeltas(_ context.Context, _ platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) ([]SynapseDelta, error) {
	deltas := []SynapseDelta{}
	for _, id := range f.contributionSynapses(removalNeuronIDs, sharedNeuronIDs) {
		pre := f.synapses[id].strength
		post := Depress(pre, amount)
		f.synapses[id].strength = post
		deltas = append(deltas, SynapseDelta{SynapseID: id, AppliedDelta: pre - post})
	}
	return deltas, nil
}

func (f *fakeReleaseRepo) ReleaseGroupForDiary(_ context.Context, _ platform.UserScope, diaryID string) (ReleaseGroup, bool, error) {
	for _, group := range f.groups {
		if group.diaryID == diaryID {
			return ReleaseGroup{ID: group.id, DiaryID: group.diaryID, DeletedAt: group.deletedAt}, true, nil
		}
	}
	return ReleaseGroup{}, false, nil
}

func (f *fakeReleaseRepo) ReleaseGroupForSweep(_ context.Context, _ platform.UserScope, releaseID string) (ReleaseGroup, bool, error) {
	group, ok := f.groups[releaseID]
	if !ok {
		return ReleaseGroup{}, false, nil
	}
	return ReleaseGroup{ID: group.id, DiaryID: group.diaryID, DeletedAt: group.deletedAt}, true, nil
}

func (f *fakeReleaseRepo) InsertReleaseGroup(_ context.Context, _ platform.UserScope, group ReleaseGroup) error {
	f.groups[group.ID] = &fakeRelGroup{id: group.ID, diaryID: group.DiaryID, deletedAt: group.DeletedAt}
	return nil
}

func (f *fakeReleaseRepo) RecordReleaseMemories(_ context.Context, _ platform.UserScope, releaseID string, memoryIDs []string) error {
	f.groups[releaseID].memoryIDs = append(f.groups[releaseID].memoryIDs, memoryIDs...)
	return nil
}

func (f *fakeReleaseRepo) RecordReleaseSealedNeurons(_ context.Context, _ platform.UserScope, releaseID string, neuronIDs []string) error {
	f.groups[releaseID].sealed = append(f.groups[releaseID].sealed, neuronIDs...)
	return nil
}

func (f *fakeReleaseRepo) RecordReleaseSynapseDeltas(_ context.Context, _ platform.UserScope, releaseID string, deltas []SynapseDelta) error {
	f.groups[releaseID].deltas = append(f.groups[releaseID].deltas, deltas...)
	return nil
}

func (f *fakeReleaseRepo) ReleaseMemories(_ context.Context, _ platform.UserScope, releaseID string) ([]string, error) {
	return append([]string(nil), f.groups[releaseID].memoryIDs...), nil
}

func (f *fakeReleaseRepo) ReleaseSealedNeurons(_ context.Context, _ platform.UserScope, releaseID string) ([]string, error) {
	return append([]string(nil), f.groups[releaseID].sealed...), nil
}

func (f *fakeReleaseRepo) ReleaseSealedNeuronTargets(_ context.Context, _ platform.UserScope, releaseID string) ([]JobTarget, error) {
	targets := make([]JobTarget, 0, len(f.groups[releaseID].sealed))
	for _, neuronID := range f.groups[releaseID].sealed {
		neuron, ok := f.neurons[neuronID]
		if !ok {
			continue
		}
		targets = append(targets, JobTarget{
			Kind:             JobTargetNeuron,
			ID:               neuronID,
			ExpectedRevision: neuron.revision,
		})
	}
	return targets, nil
}

func (f *fakeReleaseRepo) ClearReleaseMemoriesDeletedAt(_ context.Context, _ platform.UserScope, memoryIDs []string) error {
	for _, id := range memoryIDs {
		if mem, ok := f.memories[id]; ok {
			mem.deleted = false
		}
	}
	return nil
}

func (f *fakeReleaseRepo) UnsealReleaseNeurons(_ context.Context, _ platform.UserScope, neuronIDs []string) error {
	for _, id := range neuronIDs {
		if neuron, ok := f.neurons[id]; ok {
			neuron.sealed = false
		}
	}
	return nil
}

func (f *fakeReleaseRepo) ReverseReleaseSynapseDeltas(_ context.Context, _ platform.UserScope, releaseID string) error {
	for _, delta := range f.groups[releaseID].deltas {
		if synapse, ok := f.synapses[delta.SynapseID]; ok {
			synapse.strength = clamp(synapse.strength+delta.AppliedDelta, 0, values.SynapseStrengthCap)
		}
	}
	return nil
}

func (f *fakeReleaseRepo) CancelReleaseMemoryJobs(_ context.Context, _ platform.UserScope, releaseID string, memoryIDs []string, cancelledAt time.Time) error {
	for _, job := range f.jobs {
		if job.Status != JobStatusPending && job.Status != JobStatusRunning {
			continue
		}
		if !jobTargetsAny(targetMemoryIDs(job), memoryIDs) {
			continue
		}
		job.Status = JobStatusCanceled
		job.Payload = []byte("{}")
		job.TerminalAt = timePointer(cancelledAt)
		job.CanceledByReleaseID = stringPointer(releaseID)
		job.LeaseGeneration++
	}
	f.operations = append(f.operations, "cancel_jobs")
	return nil
}

func (f *fakeReleaseRepo) RequeueReleaseMemoryJobs(_ context.Context, _ platform.UserScope, releaseID string, nextRunAt time.Time) error {
	for _, job := range f.jobs {
		if job.Status != JobStatusCanceled || job.CanceledByReleaseID == nil || *job.CanceledByReleaseID != releaseID {
			continue
		}
		job.Status = JobStatusPending
		job.Payload = []byte("{}")
		job.TerminalAt = nil
		job.CanceledByReleaseID = nil
		job.NextRunAt = nextRunAt
	}
	f.operations = append(f.operations, "requeue_jobs")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseRetentionJobs(_ context.Context, _ platform.UserScope, releaseID string) error {
	for id, job := range f.jobs {
		if job.Kind == JobKindRetention && jobHasTarget(job, JobTargetRelease, releaseID) {
			delete(f.jobs, id)
		}
	}
	f.operations = append(f.operations, "delete_retention_jobs")
	return nil
}

func (f *fakeReleaseRepo) EnqueueJob(_ context.Context, _ platform.UserScope, job Job) (Job, error) {
	copyJob := job
	copyJob.Payload = append([]byte(nil), job.Payload...)
	copyJob.Targets = append([]JobTarget(nil), job.Targets...)
	f.jobs[job.ID] = &copyJob
	f.operations = append(f.operations, "enqueue:"+string(job.Kind))
	return copyJob, nil
}

func (f *fakeReleaseRepo) DeleteReleaseGroup(_ context.Context, _ platform.UserScope, releaseID string) error {
	delete(f.groups, releaseID)
	f.operations = append(f.operations, "delete_group")
	return nil
}

func (f *fakeReleaseRepo) ExpiredReleaseGroups(_ context.Context, _ platform.UserScope, cutoff time.Time) ([]ReleaseGroup, error) {
	out := []ReleaseGroup{}
	for _, group := range f.groups {
		if !group.deletedAt.After(cutoff) {
			out = append(out, ReleaseGroup{ID: group.id, DiaryID: group.diaryID, DeletedAt: group.deletedAt})
		}
	}
	return out, nil
}

func (f *fakeReleaseRepo) ExclusiveReleaseNeurons(_ context.Context, _ platform.UserScope, releaseID string, releaseMemoryIDs []string) ([]string, error) {
	inSet := map[string]bool{}
	for _, id := range releaseMemoryIDs {
		inSet[id] = true
	}
	out := []string{}
	for _, neuronID := range f.groups[releaseID].sealed {
		external := false
		for _, activation := range f.activations {
			if activation.neuronID == neuronID && !inSet[activation.memoryID] {
				external = true
				break
			}
		}
		if !external {
			out = append(out, neuronID)
		}
	}
	return out, nil
}

func (f *fakeReleaseRepo) PurgeReleaseJobs(_ context.Context, _ platform.UserScope, releaseID string, memoryIDs, neuronIDs []string) error {
	for jobID, job := range f.jobs {
		kept := make([]JobTarget, 0, len(job.Targets))
		for _, target := range job.Targets {
			remove := target.Kind == JobTargetRelease && target.ID == releaseID
			remove = remove || target.Kind == JobTargetMemory && stringIn(target.ID, memoryIDs)
			remove = remove || target.Kind == JobTargetNeuron && stringIn(target.ID, neuronIDs)
			if !remove {
				kept = append(kept, target)
			}
		}
		job.Targets = kept
		if len(job.Targets) == 0 {
			delete(f.jobs, jobID)
		}
	}
	f.operations = append(f.operations, "purge_jobs")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseActivations(_ context.Context, _ platform.UserScope, memoryIDs []string) error {
	inSet := map[string]bool{}
	for _, id := range memoryIDs {
		inSet[id] = true
	}
	kept := f.activations[:0:0]
	for _, activation := range f.activations {
		if !inSet[activation.memoryID] {
			kept = append(kept, activation)
		}
	}
	f.activations = kept
	f.operations = append(f.operations, "delete_activations")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseSynapses(_ context.Context, _ platform.UserScope, neuronIDs []string) error {
	target := map[string]bool{}
	for _, id := range neuronIDs {
		target[id] = true
	}
	for id, synapse := range f.synapses {
		if target[synapse.aID] || target[synapse.bID] {
			delete(f.synapses, id)
		}
	}
	f.operations = append(f.operations, "delete_synapses")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseEmbeddings(_ context.Context, _ platform.UserScope, _ []string) error {
	f.operations = append(f.operations, "delete_embeddings")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseNeurons(_ context.Context, _ platform.UserScope, neuronIDs []string) error {
	for _, id := range neuronIDs {
		delete(f.neurons, id)
	}
	f.operations = append(f.operations, "delete_neurons")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseMemories(_ context.Context, _ platform.UserScope, memoryIDs []string) error {
	for _, id := range memoryIDs {
		if mem, ok := f.memories[id]; ok && mem.deleted {
			delete(f.memories, id)
		}
	}
	f.operations = append(f.operations, "delete_memories")
	return nil
}

func (f *fakeReleaseRepo) DeleteReleaseDiary(_ context.Context, _ platform.UserScope, _ string) error {
	f.sweptDiary = true
	f.operations = append(f.operations, "delete_diary")
	return nil
}

func targetMemoryIDs(job *Job) []string {
	ids := []string{}
	for _, target := range job.Targets {
		if target.Kind == JobTargetMemory {
			ids = append(ids, target.ID)
		}
	}
	return ids
}

func jobTargetsAny(left, right []string) bool {
	for _, value := range left {
		if stringIn(value, right) {
			return true
		}
	}
	return false
}

func jobHasTarget(job *Job, kind JobTargetKind, id string) bool {
	for _, target := range job.Targets {
		if target.Kind == kind && target.ID == id {
			return true
		}
	}
	return false
}

func hasJobKind(jobs map[string]*Job, kind JobKind) bool {
	for _, job := range jobs {
		if job.Kind == kind {
			return true
		}
	}
	return false
}

func stringIn(value string, values []string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func timePointer(value time.Time) *time.Time {
	return &value
}

func stringPointer(value string) *string {
	return &value
}

// --- fixture -------------------------------------------------------------------------------------

func newReleaseService(t *testing.T, repo *fakeReleaseRepo, suggester *fakeSealSuggester, now time.Time) *Service {
	t.Helper()
	launches := &fakeLaunchStore{}
	service, err := NewService(ServiceDeps{
		Extractor:       &fakeExtractor{splitResult: validSplit()},
		Embedder:        &fakeEmbedder{},
		Candidates:      &fakeCandidateRepo{},
		Launches:        launches,
		Universe:        &fakeUniverseReader{},
		Linker:          &fakeLinker{},
		Progression:     &fakeProgression{store: launches},
		Recalls:         launches,
		SpendGate:       &fakeSpendGate{},
		Earn:            &fakeEarnPort{},
		PredictionError: &fakePredictionError{},
		Gists:           &fakeGistReader{},
		Signals:         launches,
		Provenance:      &fakeProvenanceReader{},
		Exports:         &fakeExportReader{},
		Diaries:         &fakeDiaryReader{},
		Releases:        repo,
		SealSuggester:   suggester,
		Now:             func() time.Time { return now },
		NewID: func() string {
			repo.nextID++
			return fmt.Sprintf("release-id-%d", repo.nextID)
		},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func releaseTestScope(t *testing.T) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope("release-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

// A one-diary graph: memory m1 (diary d1) activates an orphan semantic neuron and a shared neuron
// (also activated by the live outside memory m2), joined by a synapse.
func seedReleaseGraph(repo *fakeReleaseRepo) {
	repo.memories["m1"] = &fakeRelMemory{diaryID: "d1", name: "Market", text: "met a friend", mood: MoodCalm}
	repo.memories["m2"] = &fakeRelMemory{diaryID: "d2", name: "Outside", text: "still here", mood: MoodJoy}
	repo.neurons["n-orphan"] = &fakeRelNeuron{semantic: true, revision: 1}
	repo.neurons["n-shared"] = &fakeRelNeuron{semantic: true, revision: 1}
	repo.activations = []fakeRelActivation{
		{memoryID: "m1", neuronID: "n-orphan"},
		{memoryID: "m1", neuronID: "n-shared"},
		{memoryID: "m2", neuronID: "n-shared"},
	}
	repo.synapses["syn"] = &fakeRelSynapse{aID: "n-orphan", bID: "n-shared", strength: 0.6}
}

// --- tests ---------------------------------------------------------------------------------------

func TestReleaseSoftDeletesSealsWeakensAndLedgers(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)

	result, err := service.Release(context.Background(), releaseTestScope(t), "d1")
	if err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	if len(result.EpisodicMemoryIDs) != 1 || result.EpisodicMemoryIDs[0] != "m1" || !result.DeletedAt.Equal(now) {
		t.Fatalf("result = %+v, want [m1] at %v", result, now)
	}
	if !repo.memories["m1"].deleted {
		t.Fatal("m1 was not soft-deleted")
	}
	if !repo.neurons["n-orphan"].sealed {
		t.Fatal("orphan neuron was not sealed")
	}
	if repo.neurons["n-shared"].sealed {
		t.Fatal("shared neuron must be kept, not sealed")
	}
	if repo.synapses["syn"].strength >= 0.6 {
		t.Fatalf("shared contribution synapse = %v, want Depressed below 0.6", repo.synapses["syn"].strength)
	}
	group, ok, _ := repo.ReleaseGroupForDiary(context.Background(), releaseTestScope(t), "d1")
	if !ok {
		t.Fatal("no release group recorded")
	}
	stored := repo.groups[group.ID]
	if len(stored.memoryIDs) != 1 || len(stored.sealed) != 1 || len(stored.deltas) != 1 {
		t.Fatalf("ledger = memories %v sealed %v deltas %v, want 1/1/1", stored.memoryIDs, stored.sealed, stored.deltas)
	}
	if stored.deltas[0].AppliedDelta <= 0 {
		t.Fatalf("recorded delta = %v, want the positive LTD amount removed", stored.deltas[0].AppliedDelta)
	}
}

func TestReleaseSchedulesExactRetentionAndCancelsMemoryJobs(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	scope := releaseTestScope(t)
	repo.jobs["semantic-m1"] = &Job{
		ID:              "semantic-m1",
		UserID:          scope.UserID(),
		Kind:            JobKindSemanticize,
		Payload:         []byte(`{"current_text":"must be redacted"}`),
		Status:          JobStatusRunning,
		LeaseGeneration: 7,
		Targets: []JobTarget{{
			Kind: JobTargetMemory, ID: "m1", ExpectedRevision: 1,
		}},
	}
	repo.jobs["semantic-m2"] = &Job{
		ID:      "semantic-m2",
		UserID:  scope.UserID(),
		Kind:    JobKindSemanticize,
		Payload: []byte("{}"),
		Status:  JobStatusPending,
		Targets: []JobTarget{{
			Kind: JobTargetMemory, ID: "m2", ExpectedRevision: 1,
		}},
	}
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)

	if _, err := service.Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	group, ok, err := repo.ReleaseGroupForDiary(context.Background(), scope, "d1")
	if err != nil || !ok {
		t.Fatalf("release group = (%+v, %v, %v), want present", group, ok, err)
	}

	cancelled := repo.jobs["semantic-m1"]
	if cancelled.Status != JobStatusCanceled || cancelled.CanceledByReleaseID == nil || *cancelled.CanceledByReleaseID != group.ID {
		t.Fatalf("released-memory job = %+v, want cancelled by %s", cancelled, group.ID)
	}
	if cancelled.TerminalAt == nil || !cancelled.TerminalAt.Equal(now) {
		t.Fatalf("cancelled terminal_at = %v, want %v", cancelled.TerminalAt, now)
	}
	if string(cancelled.Payload) != "{}" || cancelled.LeaseGeneration != 8 {
		t.Fatalf("cancelled payload/generation = %s/%d, want {}/8", cancelled.Payload, cancelled.LeaseGeneration)
	}
	if outside := repo.jobs["semantic-m2"]; outside.Status != JobStatusPending {
		t.Fatalf("outside-memory job status = %q, want pending", outside.Status)
	}

	var trigger *Job
	for _, job := range repo.jobs {
		if job.Kind == JobKindRetention {
			trigger = job
		}
	}
	if trigger == nil || trigger.Kind != JobKindRetention || trigger.Status != JobStatusPending {
		t.Fatalf("retention trigger = %+v, want pending retention_sweep", trigger)
	}
	deadline := now.Add(retentionWindow())
	if !trigger.CreatedAt.Equal(now) || !trigger.NextRunAt.Equal(deadline) {
		t.Fatalf("retention trigger times = created %v next %v, want %v/%v", trigger.CreatedAt, trigger.NextRunAt, now, deadline)
	}
	if trigger.DedupKey == nil || *trigger.DedupKey != group.ID || string(trigger.Payload) != "{}" {
		t.Fatalf("retention trigger dedup/payload = %v/%s, want %s/{}", trigger.DedupKey, trigger.Payload, group.ID)
	}
	if len(trigger.Targets) != 1 || trigger.Targets[0] != (JobTarget{Kind: JobTargetRelease, ID: group.ID}) {
		t.Fatalf("retention targets = %+v, want release-group identity only", trigger.Targets)
	}
}

func TestReleaseIsIdempotentGuardNoDoubleSeal(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)
	scope := releaseTestScope(t)

	if _, err := service.Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("first Release failed: %v", err)
	}
	strengthAfterFirst := repo.synapses["syn"].strength

	if _, err := service.Release(context.Background(), scope, "d1"); !errors.Is(err, ErrAlreadyReleased) {
		t.Fatalf("second Release err = %v, want ErrAlreadyReleased", err)
	}
	if repo.synapses["syn"].strength != strengthAfterFirst {
		t.Fatal("a second Release Depressed the shared synapse again — double weaken")
	}
}

func TestReleaseRejectsNoLiveMemories(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)

	if _, err := service.Release(context.Background(), releaseTestScope(t), "unknown-diary"); !errors.Is(err, ErrReleaseNoLiveMemories) {
		t.Fatalf("Release of empty diary err = %v, want ErrReleaseNoLiveMemories", err)
	}
	if len(repo.groups) != 0 {
		t.Fatal("a release group was recorded for a diary with no live memories")
	}
}

func TestRestoreReversesWithinWindow(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	preStrength := repo.synapses["syn"].strength
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)
	scope := releaseTestScope(t)

	if _, err := service.Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	result, err := service.Restore(context.Background(), scope, "d1")
	if err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	if len(result.EpisodicMemoryIDs) != 1 || result.EpisodicMemoryIDs[0] != "m1" {
		t.Fatalf("restore result = %+v, want [m1]", result)
	}
	if repo.memories["m1"].deleted {
		t.Fatal("m1 is still soft-deleted after restore")
	}
	if repo.neurons["n-orphan"].sealed {
		t.Fatal("orphan neuron is still sealed after restore")
	}
	if diff := repo.synapses["syn"].strength - preStrength; diff < -1e-6 || diff > 1e-6 {
		t.Fatalf("synapse strength = %v, want the pre-release %v reversed exactly", repo.synapses["syn"].strength, preStrength)
	}
	if len(repo.groups) != 0 {
		t.Fatal("release group was not retired on restore")
	}
}

func TestRestoreBeforeDeadlineRemovesTriggerAndRequeuesSafely(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	restoreAt := releaseAt.Add(6 * time.Hour)
	scope := releaseTestScope(t)
	repo.jobs["semantic-m1"] = &Job{
		ID:      "semantic-m1",
		UserID:  scope.UserID(),
		Kind:    JobKindSemanticize,
		Payload: []byte("{}"),
		Status:  JobStatusPending,
		Targets: []JobTarget{{
			Kind: JobTargetMemory, ID: "m1", ExpectedRevision: 1,
		}},
	}
	if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, releaseAt).Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, restoreAt).Restore(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}

	requeued := repo.jobs["semantic-m1"]
	if requeued == nil || requeued.Status != JobStatusPending || !requeued.NextRunAt.Equal(restoreAt) {
		t.Fatalf("restored semantic job = %+v, want pending at %v", requeued, restoreAt)
	}
	if requeued.TerminalAt != nil || requeued.CanceledByReleaseID != nil || string(requeued.Payload) != "{}" {
		t.Fatalf("restored semantic terminal metadata = %+v, want cleared with identity-only payload", requeued)
	}
	for _, job := range repo.jobs {
		if job.Kind == JobKindRetention {
			t.Fatalf("retention trigger survived Restore: %+v", job)
		}
	}
	var reembed *Job
	for _, job := range repo.jobs {
		if job.Kind == JobKindEmbed {
			reembed = job
		}
	}
	if reembed == nil || reembed.Kind != JobKindEmbed || reembed.Status != JobStatusPending {
		t.Fatalf("restore re-embed = %+v, want pending embed", reembed)
	}
	if len(reembed.Targets) != 1 || reembed.Targets[0] != (JobTarget{Kind: JobTargetNeuron, ID: "n-orphan", ExpectedRevision: 1}) {
		t.Fatalf("restore re-embed targets = %+v, want current sealed-neuron revision", reembed.Targets)
	}
	if len(repo.groups) != 0 || repo.memories["m1"].deleted || repo.neurons["n-orphan"].sealed {
		t.Fatal("Restore did not atomically retire the release and restore its sources")
	}
}

func TestRestoreRefusesExpiredAndNotReleased(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	releaseNow := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, releaseNow)
	scope := releaseTestScope(t)

	// Not released yet.
	if _, err := service.Restore(context.Background(), scope, "d1"); !errors.Is(err, ErrRestoreNotReleased) {
		t.Fatalf("Restore of unreleased diary err = %v, want ErrRestoreNotReleased", err)
	}

	if _, err := service.Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	// The exact boundary belongs to the sweep: Restore is strictly before-deadline only.
	expired := releaseNow.Add(retentionWindow())
	expiredService := newReleaseService(t, repo, &fakeSealSuggester{}, expired)
	if _, err := expiredService.Restore(context.Background(), scope, "d1"); !errors.Is(err, ErrRestoreWindowExpired) {
		t.Fatalf("Restore at window boundary err = %v, want ErrRestoreWindowExpired", err)
	}
	if !repo.memories["m1"].deleted {
		t.Fatal("an expired restore must not clear the soft-delete")
	}
}

func TestSuggestLetGoSubsetsCandidatesPersistsNothingAndDerivesHeavyState(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	// A spatial neuron and the shared neuron must never surface.
	repo.neurons["n-spatial"] = &fakeRelNeuron{semantic: false}
	repo.activations = append(repo.activations, fakeRelActivation{memoryID: "m1", neuronID: "n-spatial"})
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	suggester := &fakeSealSuggester{}
	service := newReleaseService(t, repo, suggester, now)
	scope := releaseTestScope(t)

	result, err := service.SuggestLetGo(context.Background(), scope, "m1", "just words")
	if err != nil {
		t.Fatalf("SuggestLetGo failed: %v", err)
	}
	if len(result.Candidates) != 1 || result.Candidates[0].NeuronID != "n-orphan" {
		t.Fatalf("candidates = %+v, want only the this-memory-only semantic n-orphan", result.Candidates)
	}
	if result.HeavyState.Detected {
		t.Fatalf("heavy_state = %+v, want undetected for neutral words", result.HeavyState)
	}
	if suggester.calls != 1 {
		t.Fatalf("SealSuggester calls = %d, want 1", suggester.calls)
	}
	// Persists nothing: no transaction ran, no ledger row.
	if repo.txCount != 0 || len(repo.groups) != 0 {
		t.Fatalf("SuggestLetGo wrote state: txCount=%d groups=%d", repo.txCount, len(repo.groups))
	}

	heavy, err := service.SuggestLetGo(context.Background(), scope, "m1", "I feel hopeless about all of it")
	if err != nil {
		t.Fatalf("SuggestLetGo (heavy) failed: %v", err)
	}
	if !heavy.HeavyState.Detected {
		t.Fatalf("heavy_state = %+v, want detected for a distress cue", heavy.HeavyState)
	}
}

func TestSuggestLetGoDropsReferencesOutsideTheOfferedSet(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	// A misbehaving suggester that references the shared neuron + a foreign id must be filtered out.
	suggester := &fakeSealSuggester{suggest: func(_ MemorySummary, _ string, candidates []SealCandidateRef) (SealSuggestion, error) {
		return SealSuggestion{Candidates: []SealCandidate{
			{NeuronID: "n-orphan", Reason: "ok"},
			{NeuronID: "n-shared", Reason: "should be dropped"},
			{NeuronID: "n-foreign", Reason: "should be dropped"},
		}}, nil
	}}
	service := newReleaseService(t, repo, suggester, now)

	result, err := service.SuggestLetGo(context.Background(), releaseTestScope(t), "m1", "words")
	if err != nil {
		t.Fatalf("SuggestLetGo failed: %v", err)
	}
	if len(result.Candidates) != 1 || result.Candidates[0].NeuronID != "n-orphan" {
		t.Fatalf("candidates = %+v, want only the offered n-orphan (shared/foreign dropped)", result.Candidates)
	}
	if result.Candidates[0].Name != "n-orphan" {
		t.Fatalf("candidate name = %q, want the authoritative offered name", result.Candidates[0].Name)
	}
}

func TestLetGoSealsOnlyApprovedAndRejectsForeign(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, now)
	scope := releaseTestScope(t)

	// A shared neuron is not a this-memory-only candidate → rejected, nothing sealed.
	if _, err := service.LetGo(context.Background(), scope, "m1", []string{"n-shared"}); !errors.Is(err, ErrLetGoInvalidApproved) {
		t.Fatalf("LetGo of shared neuron err = %v, want ErrLetGoInvalidApproved", err)
	}
	if repo.neurons["n-shared"].sealed || repo.neurons["n-orphan"].sealed {
		t.Fatal("a rejected LetGo sealed something")
	}

	// The this-memory-only semantic neuron seals; the memory is never soft-deleted.
	result, err := service.LetGo(context.Background(), scope, "m1", []string{"n-orphan"})
	if err != nil {
		t.Fatalf("LetGo failed: %v", err)
	}
	if len(result.SealedNeuronIDs) != 1 || result.SealedNeuronIDs[0] != "n-orphan" {
		t.Fatalf("sealed = %v, want [n-orphan]", result.SealedNeuronIDs)
	}
	if !repo.neurons["n-orphan"].sealed {
		t.Fatal("approved neuron was not sealed")
	}
	if repo.memories["m1"].deleted {
		t.Fatal("LetGo soft-deleted the memory — letting-go keeps the silent engram")
	}
	if len(repo.groups) != 0 {
		t.Fatal("LetGo wrote a release ledger row — it is permanent, not restorable")
	}
}

func TestRetentionSweeperDueNoOpAndEarlyRetry(t *testing.T) {
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	deadline := releaseAt.Add(retentionWindow())

	t.Run("early retries at the exact deadline without mutation", func(t *testing.T) {
		repo := newFakeReleaseRepo()
		seedReleaseGraph(repo)
		scope := releaseTestScope(t)
		if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, releaseAt).Release(context.Background(), scope, "d1"); err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		group, ok, err := repo.ReleaseGroupForDiary(context.Background(), scope, "d1")
		if err != nil || !ok {
			t.Fatalf("release group = (%+v, %v, %v), want present", group, ok, err)
		}

		swept, err := NewRetentionSweeper(repo).SweepRelease(context.Background(), scope, group.ID, deadline.Add(-time.Nanosecond))
		if swept {
			t.Fatal("an early retention claim reported a sweep")
		}
		var notDue retentionNotDueError
		if !errors.As(err, &notDue) || !notDue.RetryAt().Equal(deadline) {
			t.Fatalf("early sweep err = %v (retry %v), want retention retry at %v", err, notDue.RetryAt(), deadline)
		}
		if _, ok := repo.groups[group.ID]; !ok || !repo.memories["m1"].deleted {
			t.Fatal("an early retention claim mutated the released aggregate")
		}
		if !hasJobKind(repo.jobs, JobKindRetention) {
			t.Fatal("an early retention claim lost its durable trigger")
		}
	})

	t.Run("exact deadline sweeps", func(t *testing.T) {
		repo := newFakeReleaseRepo()
		seedReleaseGraph(repo)
		scope := releaseTestScope(t)
		if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, releaseAt).Release(context.Background(), scope, "d1"); err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		group, ok, err := repo.ReleaseGroupForDiary(context.Background(), scope, "d1")
		if err != nil || !ok {
			t.Fatalf("release group = (%+v, %v, %v), want present", group, ok, err)
		}

		swept, err := NewRetentionSweeper(repo).SweepRelease(context.Background(), scope, group.ID, deadline)
		if err != nil || !swept {
			t.Fatalf("deadline sweep = (%v, %v), want (true, nil)", swept, err)
		}
		if _, ok := repo.groups[group.ID]; ok {
			t.Fatal("deadline sweep retained the release group")
		}
		if _, ok := repo.memories["m1"]; ok {
			t.Fatal("deadline sweep retained the released memory")
		}
	})

	t.Run("restored group is a no-op", func(t *testing.T) {
		repo := newFakeReleaseRepo()
		seedReleaseGraph(repo)
		scope := releaseTestScope(t)
		if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, releaseAt).Release(context.Background(), scope, "d1"); err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		group, ok, err := repo.ReleaseGroupForDiary(context.Background(), scope, "d1")
		if err != nil || !ok {
			t.Fatalf("release group = (%+v, %v, %v), want present", group, ok, err)
		}
		if _, err := newReleaseService(t, repo, &fakeSealSuggester{}, releaseAt.Add(time.Hour)).Restore(context.Background(), scope, "d1"); err != nil {
			t.Fatalf("Restore failed: %v", err)
		}

		swept, err := NewRetentionSweeper(repo).SweepRelease(context.Background(), scope, group.ID, deadline)
		if err != nil || swept {
			t.Fatalf("restored-group sweep = (%v, %v), want (false, nil)", swept, err)
		}
		if repo.memories["m1"].deleted {
			t.Fatal("restored-group no-op re-deleted the live memory")
		}
	})
}

func TestSweepHardDeletesOnlyExpiredGroups(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	seedReleaseGraph(repo)
	releaseNow := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, repo, &fakeSealSuggester{}, releaseNow)
	scope := releaseTestScope(t)

	if _, err := service.Release(context.Background(), scope, "d1"); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	repo.jobs["memory-job"] = &Job{
		ID: "memory-job", UserID: scope.UserID(), Kind: JobKindSemanticize, Status: JobStatusCanceled,
		Payload: []byte("{}"), Targets: []JobTarget{{Kind: JobTargetMemory, ID: "m1", ExpectedRevision: 1}},
	}
	repo.jobs["mixed-neuron-job"] = &Job{
		ID: "mixed-neuron-job", UserID: scope.UserID(), Kind: JobKindEmbed, Status: JobStatusPending,
		Payload: []byte("{}"), Targets: []JobTarget{
			{Kind: JobTargetNeuron, ID: "n-orphan", ExpectedRevision: 1},
			{Kind: JobTargetNeuron, ID: "n-shared", ExpectedRevision: 1},
		},
	}

	// A sweep at release time removes nothing (group is fresh).
	if swept, err := service.Sweep(context.Background(), scope, releaseNow); err != nil || swept != 0 {
		t.Fatalf("early sweep = (%d, %v), want (0, nil)", swept, err)
	}
	if _, ok := repo.memories["m1"]; !ok {
		t.Fatal("a fresh release was hard-deleted")
	}

	// The exact deadline is eligible. Queue targets go first, before any source row is removed.
	repo.operations = nil
	deadline := releaseNow.Add(retentionWindow())
	swept, err := service.Sweep(context.Background(), scope, deadline)
	if err != nil || swept != 1 {
		t.Fatalf("deadline sweep = (%d, %v), want (1, nil)", swept, err)
	}
	wantOperations := []string{
		"purge_jobs",
		"delete_activations",
		"delete_synapses",
		"delete_embeddings",
		"delete_neurons",
		"delete_memories",
		"delete_diary",
		"delete_group",
	}
	if !slices.Equal(repo.operations, wantOperations) {
		t.Fatalf("sweep operations = %v, want FK-safe metadata-first order %v", repo.operations, wantOperations)
	}
	if _, ok := repo.jobs["memory-job"]; ok || hasJobKind(repo.jobs, JobKindRetention) {
		t.Fatal("sweep retained job metadata for deleted memory/release targets")
	}
	mixed := repo.jobs["mixed-neuron-job"]
	if mixed == nil || len(mixed.Targets) != 1 || mixed.Targets[0].ID != "n-shared" {
		t.Fatalf("mixed job after sweep = %+v, want only its live shared-neuron target", mixed)
	}
	if _, ok := repo.memories["m1"]; ok {
		t.Fatal("the expired release's memory was not hard-deleted")
	}
	if _, ok := repo.neurons["n-orphan"]; ok {
		t.Fatal("the exclusive sealed orphan neuron was not hard-deleted")
	}
	if _, ok := repo.neurons["n-shared"]; !ok {
		t.Fatal("the shared neuron was hard-deleted — the sweep must never remove a shared neuron")
	}
	if _, ok := repo.memories["m2"]; !ok {
		t.Fatal("the outside live memory was hard-deleted")
	}
	if !repo.sweptDiary {
		t.Fatal("the diary row was not hard-deleted")
	}
	if len(repo.groups) != 0 {
		t.Fatal("the release group was not retired after sweep")
	}
}

func TestReleasePathsRejectEmptyScope(t *testing.T) {
	t.Parallel()
	repo := newFakeReleaseRepo()
	service := newReleaseService(t, repo, &fakeSealSuggester{}, time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC))
	empty := platform.UserScope{}
	ctx := context.Background()

	if _, err := service.Release(ctx, empty, "d1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("Release empty scope err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.Restore(ctx, empty, "d1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("Restore empty scope err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.SuggestLetGo(ctx, empty, "m1", "w"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("SuggestLetGo empty scope err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.LetGo(ctx, empty, "m1", nil); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("LetGo empty scope err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.Sweep(ctx, empty, time.Now()); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("Sweep empty scope err = %v, want ErrScopeRequired", err)
	}
	// A scope check must precede any repository work.
	if repo.txCount != 0 {
		t.Fatalf("a scope-less call opened a transaction (txCount=%d)", repo.txCount)
	}
}

// values import guard: the retention window is the generated constant, referenced here so the test
// file fails to compile if the constant is renamed away.
var _ = values.ReleaseSoftDeleteRetentionDays
