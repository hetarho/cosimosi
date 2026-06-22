package job

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/backend/internal/db/fragment"
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
	// LoadExcitabilityInputs reads what the worker needs to score cluster excitability
	// (spec 22) for the given candidate ids: each candidate's last_recalled_at and the
	// synapses touching any candidate (cluster derivation + co-activation events). All
	// DERIVED from existing timestamps — no excitability column (acceptance 1.5).
	LoadExcitabilityInputs(ctx context.Context, userID string, ids []string) (ExcitabilityInputs, error)
	// BatchUpsertLinks inserts/strengthens the semantic synapses in one statement.
	BatchUpsertLinks(ctx context.Context, links []LinkUpsert) error

	// --- nightly consolidation (spec 27) ---

	// LoadConsolidateGraph reads the whole user graph the nightly pass operates on:
	// every star (id + last_recalled_at + cached stable coords) and every synapse
	// (a/b + weight + last_activated_at). The coords are a CACHE, not authority
	// (constitution §3) — the server seeds its own re-layout from them.
	LoadConsolidateGraph(ctx context.Context, userID string) (ConsolidateGraph, error)
	// RunConsolidation applies passes ②–④ AND completes the job in ONE transaction:
	// cache the re-stabilized coords, gist-simplify (RETURNING) + append a coherent
	// nightly_gist history row per gisted star, prune weak links, then mark the job
	// done. Atomic completion is what makes a retry exactly-once — a failure rolls back
	// every write together so the next attempt re-runs from a clean slate (the gist step
	// is monotonic but NOT idempotent if re-applied, so it must not commit without the
	// job's completion). Returns the number of stars gisted (for the log). Never deletes
	// rows (constitution §2) and never touches records (§1).
	RunConsolidation(ctx context.Context, jobID, userID string, w ConsolidationWrite) (gisted int, err error)
}

// ConsolidationWrite is the nightly pass's write payload (spec 27) — the re-stabilized
// coordinate cache plus the gist/prune thresholds, applied atomically by RunConsolidation.
type ConsolidationWrite struct {
	Coords           []StableCoord // ①② re-stabilized coords to cache (re-entry only — §3)
	Simplify         float64       // ③ form_seed_delta monotonic step
	AgeCutoff        time.Time     // ③ gist only stars created before this
	RecallCutoff     time.Time     // ③ …and un-recalled since this
	GistDedupeCutoff time.Time     // ③ …and not already nightly-gisted since this (reclaim idempotency)
	WeakThreshold    float64       // ④ prune links weaker than this
	Floor            float64       // ④ …down to this weight (dim, never deleted)
	IdleCutoff       time.Time     // ④ …and un-activated since this
}

// Scheduler is the nightly ticker's PRODUCER port (spec 27). It is deliberately
// separate from the consumer Repository (which has no Enqueue — see above): the
// ticker enqueues consolidate jobs outside any RecordMemory transaction, so a
// pool-scoped enqueue here is correct. The pgx implementation is in repository_pg.go.
type Scheduler interface {
	// ActiveUserIDs lists users with at least one star — the consolidate targets.
	ActiveUserIDs(ctx context.Context) ([]string, error)
	// EnqueueConsolidate enqueues one consolidate job for the user, idempotently:
	// it is a no-op if a pending/running consolidate job already exists for them
	// (so a double-ticker or multiple daily wakeups never stack duplicates).
	// Returns true when a job was actually enqueued.
	EnqueueConsolidate(ctx context.Context, userID string) (bool, error)
}

// ConsolidateGraph is the nightly pass's whole-graph input (spec 27).
type ConsolidateGraph struct {
	Stars []ConsolidateStar
	Links []ConsolidateLink
}

// ConsolidateStar is one node for the server-side re-layout: its recency (the
// redistribution/excitability weight) plus the cached stable coordinate (nil =
// never cached → cold seed). Coords are a re-entry cache, not authority (§3).
type ConsolidateStar struct {
	ID             string
	LastRecalledAt time.Time
	StableX        *float64
	StableY        *float64
	StableZ        *float64
}

// ConsolidateLink is one weighted, undirected synapse for the re-layout springs +
// cluster derivation. LastActivatedAt feeds the cluster excitability bias.
type ConsolidateLink struct {
	AID             string
	BID             string
	Weight          float64
	LastActivatedAt time.Time
}

// StableCoord is one star's re-stabilized coordinate to cache (§3 — cache only).
type StableCoord struct {
	ID string
	X  float64
	Y  float64
	Z  float64
}

// ExcitabilityInputs is the worker's raw material for the competitive-allocation
// re-rank (spec 22): the candidate stars' recency and the synapses among/around them.
// A pure domain value (no db/proto tags — constitution §5); the worker turns it into
// per-cluster excitability inside biasedLinks.
type ExcitabilityInputs struct {
	// Recalled maps a candidate memory id → its last_recalled_at (an excitability event).
	Recalled map[string]time.Time
	// Links are the synapses touching any candidate (a_id/b_id + last_activated_at): the
	// union-find input for cluster derivation and a co-activation excitability event.
	Links []ClusterLink
	// Arousal is the user-level "요즘" envelope derived from all stars' Bjork R; it
	// scales W_EXC through memory.ExcitabilityGain.
	Arousal float64
}

// ClusterLink is one synapse the cluster derivation walks: an undirected (a,b) pair
// with the time it was last co-activated.
type ClusterLink struct {
	AID             string
	BID             string
	LastActivatedAt time.Time
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

// Segment is one event-boundary fragment to persist as a star (spec 21) — an
// alias of the shared fan-out core's shape (db/fragment), NOT ai.Segment, so
// the GraphStore port stays decoupled from the extractor adapter layer; the
// worker maps between them.
type Segment = fragment.Segment

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
