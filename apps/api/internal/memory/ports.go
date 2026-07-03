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
// path cannot express an [I1]/[I2] violation.
type LaunchTx interface {
	LatestLaunchedUniverseTime(ctx context.Context, scope platform.UserScope) (*time.Time, error)
	InsertDiary(ctx context.Context, scope platform.UserScope, diary Diary) (Diary, error)
	InsertEpisodicMemory(ctx context.Context, scope platform.UserScope, episodicMemory EpisodicMemory) (EpisodicMemory, error)
	FindNeuronsByNames(ctx context.Context, scope platform.UserScope, names []string) ([]ExistingNeuron, error)
	UpsertNeuron(ctx context.Context, scope platform.UserScope, neuron Neuron) (Neuron, error)
	InsertNeuronActivation(ctx context.Context, scope platform.UserScope, activation NeuronActivation) (NeuronActivation, error)
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
}

// UniverseReader backs the GetUniverse read over the stored facts (plan 16's
// universe queries).
type UniverseReader interface {
	GetUniverse(ctx context.Context, scope platform.UserScope) (UniverseFacts, error)
}

// Linker is the in-transaction Link seam (plan 21): PersistEncoded invokes it as
// the last step of its transaction so synapse writes land atomically with the
// launch. Job 27 provides the implementation; until then the seam stays nil and
// no synapse is created at launch.
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
