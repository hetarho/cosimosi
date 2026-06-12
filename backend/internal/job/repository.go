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
	// Stats counts the queue by status and measures the oldest pending job's age —
	// the worker logs it periodically so a silent backlog is visible (spec 18).
	Stats(ctx context.Context) (QueueStats, error)
}

// QueueStats is one snapshot of the job queue for the periodic summary log.
// DuePending counts only jobs claimable right now (next_run_at <= now) —
// Pending also includes retries waiting out their backoff.
type QueueStats struct {
	Pending          int
	DuePending       int
	Running          int
	Failed           int
	OldestPendingAge time.Duration
}

// GraphStore is the worker's view over fragment fan-out + embedding + synapse
// persistence. It is a consumer-side port kept in the job package because the
// worker owns the pipeline; the pgx implementation is in repository_pg.go.
type GraphStore interface {
	// GetRecordForExtract loads what the extract worker segments: the immutable
	// diary body, its owner/date, and the optional manual-emotion hints (spec 21).
	GetRecordForExtract(ctx context.Context, recordID string) (RecordForExtract, error)
	// FragmentIDs returns the record's existing fragment star ids (fragment
	// order). The worker checks it BEFORE paying the LLM extraction call so a
	// job reclaimed after a crash-before-Complete doesn't re-extract.
	FragmentIDs(ctx context.Context, recordID string) ([]string, error)
	// FanOutFragments persists one diary's segments as fragment stars in a SINGLE
	// transaction (spec 21): N memories + one embed job each + the intra-entry
	// links (w=0.8) between every fragment pair — partial failure rolls back all.
	// If the record already has fragments (a retried/reclaimed extract job), it
	// inserts nothing and returns the existing ids — fan-out is idempotent.
	FanOutFragments(ctx context.Context, recordID, userID string, segs []Segment) (memoryIDs []string, err error)
	// GetMemoryForEmbed loads the star's owner, the fragment text (whole-diary
	// body fallback), and entry_date for embedding.
	GetMemoryForEmbed(ctx context.Context, memoryID string) (MemoryForEmbed, error)
	// UpsertEmbedding stores/replaces the memory's vector and the model that made it.
	UpsertEmbedding(ctx context.Context, memoryID, userID string, vec []float32, model string) error
	// KnnNearest returns up to k same-user neighbors (excluding self) with cosine
	// similarity ≥ τ, nearest first, each with its record entry_date.
	KnnNearest(ctx context.Context, userID string, vec []float32, selfID string, k int) ([]Neighbor, error)
	// BatchUpsertLinks inserts/strengthens the semantic synapses in one statement.
	BatchUpsertLinks(ctx context.Context, links []LinkUpsert) error
}

// RecordForExtract is the extract worker's input: the immutable original plus
// the user's optional whole-diary emotion hints (zero values = no hint).
type RecordForExtract struct {
	UserID        string
	Body          string
	EntryDate     time.Time
	HintMood      string
	HintIntensity float64
	HintValence   float64
}

// Segment is one event-boundary fragment to persist as a star (spec 21). It is
// the job package's OWN shape (not ai.Segment) so the GraphStore port stays
// decoupled from the extractor adapter layer; the worker maps between them.
type Segment struct {
	Index     int
	Text      string
	Mood      string // 13-value lowercase mood, "" = unset
	Intensity float64
	Valence   float64
}

// MemoryForEmbed is the input the worker embeds. Text is the fragment's own
// text (or the whole diary body when fragment_text is NULL).
type MemoryForEmbed struct {
	UserID    string
	Text      string
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
