package memory

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

type Extractor interface {
	Split(ctx context.Context, body string, diaryDate time.Time, existingNeurons []ExistingNeuron) (ExtractResult, error)
	ReviseSplit(ctx context.Context, prior ExtractResult, instruction string) (ExtractResult, error)
}

type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
}

type Semanticizer interface {
	GenerateSemanticStages(ctx context.Context, memory SemanticizeMemory) (SemanticStages, error)
}

type JobQueue interface {
	ClaimDue(ctx context.Context, now time.Time) (Job, error)
	Complete(ctx context.Context, job Job) error
	Retry(ctx context.Context, job Job, nextAttempts int32, nextRunAt time.Time) error
	Fail(ctx context.Context, job Job, nextAttempts int32) error
}

type EmbeddingWriter interface {
	UpsertEmbeddings(ctx context.Context, userID string, embeddings []Embedding) error
}

type SemanticStagesWriter interface {
	SaveSemanticStages(ctx context.Context, userID string, memoryID string, stages SemanticStages) error
}

// NeuronCandidateRepo assembles the per-user dedup-candidate set Encode hands the
// extractor to canonicalize against ([E10]): a name match against the diary body
// plus the narrow embedding nearest-neighbour assist.
type NeuronCandidateRepo interface {
	ListNeuronCandidatesInBody(ctx context.Context, scope platform.UserScope, body string, limit int32) ([]ExistingNeuron, error)
	ListNearestNeuronCandidates(ctx context.Context, scope platform.UserScope, vector []float32, minSimilarity float64, limit int32) ([]ExistingNeuron, error)
}

// LaunchRepo runs PersistEncoded's single transaction: fn's writes commit wholly
// or not at all.
type LaunchRepo interface {
	InLaunchTx(ctx context.Context, fn func(tx LaunchTx) error) error
}

// LaunchTx is the transaction-scoped write surface PersistEncoded consumes. It
// deliberately exposes no Diary update and no delete of any kind, so the launch
// path cannot express an [I1]/[I2] violation. It embeds SynapseStore so Link's
// synapse reads and writes run on the very same transaction (§2.6), and
// UniverseClockStore so the clock read + advance land atomically with the
// launch rows ([T2] case 1).
type LaunchTx interface {
	InsertDiary(ctx context.Context, scope platform.UserScope, diary Diary) (Diary, error)
	InsertEpisodicMemory(ctx context.Context, scope platform.UserScope, episodicMemory EpisodicMemory) (EpisodicMemory, error)
	FindNeuronsByNames(ctx context.Context, scope platform.UserScope, names []string) ([]ExistingNeuron, error)
	UpsertNeuron(ctx context.Context, scope platform.UserScope, neuron Neuron) (Neuron, error)
	InsertNeuronActivation(ctx context.Context, scope platform.UserScope, activation NeuronActivation) (NeuronActivation, error)
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
	SynapseStore
	UniverseClockStore
}

// UniverseClockStore is the consumer-owned port over the per-user authoritative
// universe clock ([T5]). UniverseClock returns nil for the unborn clock (no
// launches yet — lazy birth); UniverseClockForUpdate is the launch guard's
// locked read, holding the clock row so concurrent launches serialize on the
// guard instead of racing it; LatestLaunchedUniverseTime is the guard baseline
// while the clock row is unborn (keeps the guard consistent with the universe
// read's fallback); AdvanceUniverseClock is the GREATEST upsert, so no caller
// can move the clock backward ([I10]). Method names match the memory/pg
// concrete, which implements this implicitly.
type UniverseClockStore interface {
	UniverseClock(ctx context.Context, scope platform.UserScope) (*time.Time, error)
	UniverseClockForUpdate(ctx context.Context, scope platform.UserScope) (*time.Time, error)
	LatestLaunchedUniverseTime(ctx context.Context, scope platform.UserScope) (*time.Time, error)
	AdvanceUniverseClock(ctx context.Context, scope platform.UserScope, target time.Time) (time.Time, error)
}

// ProgressionTx is the narrow write surface an AdvanceProgression binding may
// touch: the job queue (advance-implied work is enqueued, not run inline) and
// the clock. Deliberately NOT the full LaunchTx — a progression handler must
// never be able to insert launch rows, keeping the sync path's "mutates no
// Diary" guarantee structural ([I2]). LaunchTx satisfies this by embedding.
type ProgressionTx interface {
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
	UniverseClockStore
}

// AdvanceProgression is the read-time progression hook ([T4]): fired inside
// the advance transaction whenever the clock actually moves (launch and sync),
// with the interval the clock crossed. A nil from is the first-ever advance;
// an advance that holds the clock (same-day sync, equal-date launch) fires
// nothing. The tx surface is passed so a binding's writes — the consolidation/
// semanticize work an interval implies — join the advance atomically; the
// shipped default is the documented no-op (forgetting is read-time and needs
// no work at advance). There is no cron anywhere: this hook is the only
// advance-triggered seam.
type AdvanceProgression interface {
	OnAdvance(ctx context.Context, scope platform.UserScope, tx ProgressionTx, from *time.Time, to time.Time) error
}

// SynapseStore is the consumer-owned port (§2.4) Link consumes to grow the neuron
// synapse graph. It is embedded in LaunchTx so every read/write joins
// PersistEncoded's transaction; each method is scoped to the authenticated user
// (§4). The port speaks domain values only — no sqlc row escapes memory/pg.
type SynapseStore interface {
	// CoActivations returns, for the given neurons, every episodic memory each is
	// activated by with that memory's created_universe_time (= diary_date). Link
	// intersects two neurons' memberships to find the memories that co-activate a
	// pair and times the temporal bonus on those dates, never on a neuron [L4][E6].
	CoActivations(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]NeuronMemoryActivation, error)
	// SynapseStrengths reads, in one query, the stored base strength of every synapse
	// whose both endpoints are among neuronIDs — the repeat-path bases Link folds via
	// Potentiate [L8], keyed by canonical pair. A pair absent from the result is
	// first-time and seeded from InitialStrength [L10].
	SynapseStrengths(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]NeuronPairStrength, error)
	// UpsertSynapse is the atomic weighted upsert (§2.6): it inserts a first edge
	// or advances the existing row's stored base strength, co_activation_count, and
	// last_activated_universe_time. It only inserts or strengthens — never deletes.
	UpsertSynapse(ctx context.Context, scope platform.UserScope, synapse Synapse) (Synapse, error)
}

// NeuronMemoryActivation is one (neuron, episodic memory, memory date) membership
// row the SynapseStore returns — the join Link classifies the shared and temporal
// signals from. Time lives on the memory's date [E6], never on the neuron.
type NeuronMemoryActivation struct {
	NeuronID   string
	MemoryID   string
	MemoryDate time.Time
}

// NeuronPairStrength is one existing synapse's stored base strength for a canonical
// neuron pair (neuron_a_id < neuron_b_id), the repeat-path input to Potentiate [L8].
type NeuronPairStrength struct {
	NeuronAID string
	NeuronBID string
	Strength  float64
}

// UniverseReader backs the GetUniverse read over the stored universe facts.
type UniverseReader interface {
	GetUniverse(ctx context.Context, scope platform.UserScope) (UniverseFacts, error)
}

// Linker is the in-transaction Link seam: PersistEncoded invokes it as
// the last step of its transaction so synapse writes land atomically with the
// launch. A nil Linker skips linking (no synapse is created at launch).
type Linker interface {
	LinkLaunched(ctx context.Context, scope platform.UserScope, tx LaunchTx, launched []LaunchedMemory) error
}

// LaunchedMemory is what the Link seam receives per launched memory: the persisted
// aggregate plus the resolved (deduped) neuron ids it activates.
type LaunchedMemory struct {
	EpisodicMemory
	NeuronIDs []string
}

type ExistingNeuron struct {
	ID   string
	Name string
	Type NeuronType
}

type ExtractResult struct {
	Memories []ExtractedMemory
}

type ExtractedMemory struct {
	Name    string
	Mood    Mood
	Neurons []ExtractedNeuron
}

type ExtractedNeuron struct {
	Name string
	Type NeuronType
}

type SemanticizeMemory struct {
	ID          string
	Name        string
	CurrentText string
	Mood        Mood
	Neurons     []ExtractedNeuron
}
