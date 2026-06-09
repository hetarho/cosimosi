package job

import (
	"context"
	"errors"
	"time"
)

// ErrNoJob is returned by Claim when no due pending job is available.
var ErrNoJob = errors.New("job: no pending job")

// Repository is the queue consumer port the worker depends on: claim, complete,
// fail. Enqueue is intentionally NOT here — RecordMemory enqueues inside its own
// transaction (spec 04) so record→memory→job is atomic; a pool-scoped enqueue on
// this port would silently break that. The pgx implementation is in repository_pg.go.
type Repository interface {
	// Claim atomically locks one claimable job of the kind (a due pending job, or a
	// stale running job past the lease) and marks it running (FOR UPDATE SKIP LOCKED
	// → concurrent-worker safe). Returns ErrNoJob if none.
	Claim(ctx context.Context, kind Kind) (Job, error)
	Complete(ctx context.Context, id string) error
	// Fail records the error and reschedules: status='pending' with a future
	// next_run_at to retry, or status='failed' to preserve a give-up (never
	// deletes — constitution §1/§2). attempts is incremented by the query.
	Fail(ctx context.Context, id string, status Status, errMsg string, nextRunAt time.Time) error
}

// GraphStore is the worker's view over embedding + synapse persistence. It is a
// consumer-side port kept in the job package because the worker owns the
// embedding pipeline; the pgx implementation is in repository_pg.go.
type GraphStore interface {
	// GetMemoryForEmbed loads the star's owner, original body, and entry_date
	// (memories JOIN records) for embedding.
	GetMemoryForEmbed(ctx context.Context, memoryID string) (MemoryForEmbed, error)
	// UpsertEmbedding stores/replaces the memory's vector and the model that made it.
	UpsertEmbedding(ctx context.Context, memoryID, userID string, vec []float32, model string) error
	// KnnNearest returns up to k same-user neighbors (excluding self) with cosine
	// similarity ≥ τ, nearest first, each with its record entry_date.
	KnnNearest(ctx context.Context, userID string, vec []float32, selfID string, k int) ([]Neighbor, error)
	// BatchUpsertLinks inserts/strengthens the semantic synapses in one statement.
	BatchUpsertLinks(ctx context.Context, links []LinkUpsert) error
}

// MemoryForEmbed is the input the worker embeds.
type MemoryForEmbed struct {
	UserID    string
	Body      string
	EntryDate time.Time
}

// Neighbor is one KNN candidate returned by GraphStore.KnnNearest.
type Neighbor struct {
	MemoryID  string
	CosSim    float64
	EntryDate time.Time
}

// LinkUpsert is one normalized (a_id < b_id) semantic synapse to persist.
type LinkUpsert struct {
	AID    string
	BID    string
	Weight float64
	UserID string
}
