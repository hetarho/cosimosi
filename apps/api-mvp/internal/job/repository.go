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
	// every star (id + last_recalled_at + the raw fields the change-18 radius needs:
	// intensity, recall_count + cached stable coords) and every synapse (a/b + weight +
	// link_type + severed + last_activated_at). The coords are a CACHE, not authority
	// (constitution §3) — the server seeds its own re-layout from them.
	LoadConsolidateGraph(ctx context.Context, userID string) (ConsolidateGraph, error)
	// ReknnCandidates lists the old, isolated-or-severed stars the nightly re-KNN pass
	// re-embeds against (spec 27 change 20): created before ageCutoff with no healthy link
	// (weight ≥ activeThreshold AND not severed), each with its embedding vector. The worker
	// re-runs KNN per candidate to late-link similar memories that appeared since.
	ReknnCandidates(ctx context.Context, userID string, ageCutoff time.Time, activeThreshold float64) ([]ReknnCandidate, error)
	// RunConsolidation applies the nightly write passes AND completes the job in ONE
	// transaction: cache the re-stabilized in-scope coords, reweight links (temporal↓·
	// semantic↑), abstract stars by radius (RETURNING) + append a coherent nightly_gist
	// history row per advanced star, prune weak links (sever, last-link protected), revive/
	// create the re-KNN links, then mark the job done. Atomic completion is what makes a retry
	// exactly-once — a failure rolls back every write together so the next attempt re-runs from
	// a clean slate. The radius-triggered abstraction is idempotent (GREATEST, target>current),
	// so a re-run never double-advances. Returns the number of stars advanced (for the log).
	// Never deletes rows (constitution §2) and never touches records (§1).
	RunConsolidation(ctx context.Context, jobID, userID string, w ConsolidationWrite) (advanced int, err error)

	// --- reconsolidation content rewrite (spec 54) ---

	// GetRewriteInput loads what the rewrite worker needs for one star: its current displayed
	// text (latest variant content → fragment_text → whole-diary body fallback), abstraction
	// stage (drives the rewrite strength), owner, and current version. The original record is
	// never read for mutation — only as the text fallback (헌법1).
	GetRewriteInput(ctx context.Context, memoryID string) (RewriteInput, error)
	// ApplyRewrite persists one content rewrite AND completes the job in ONE transaction:
	// version++ on the mutable star + an append-only 'ai_rewrite' variant row carrying the new
	// text + mark the job done (so version, log, and completion can never diverge — same
	// exactly-once atomicity as RunConsolidation). The visual reshaping state is snapshotted
	// unchanged (this variant only changes *content*); the immutable record is never touched
	// (헌법1·§2 — INSERT-only log, no row deletes). Atomic completion is what makes a retry safe:
	// ApplyRewrite is not idempotent, so committing the job done in the same tx prevents a
	// crash-before-complete from re-blurring the already-blurred text on the next claim.
	ApplyRewrite(ctx context.Context, jobID, memoryID, userID, content string) error
}

// RewriteInput is the rewrite worker's per-star input (spec 54): the current displayed text
// to re-tell, the abstraction stage that scales the blur, and the owner for the write guard.
type RewriteInput struct {
	UserID           string
	Text             string
	AbstractionStage int
}

// ConsolidationWrite is the nightly pass's write payload (spec 27 change 20), applied
// atomically by RunConsolidation: the re-stabilized in-scope coordinate cache, the link
// reweight/prune knobs, the radius-derived abstraction targets, and the re-KNN links.
type ConsolidationWrite struct {
	Coords        []StableCoord // re-stabilized in-scope coords to cache (re-entry only — §3)
	TemporalDecay float64       // reweight: temporal-class link weight ×= this (<1)
	SemanticGain  float64       // reweight: semantic link weight += this…
	SemanticCap   float64       // …capped here (connection.semantic_weight_cap)
	GistStages    []StageTarget // abstraction targets (radius → stage); SQL bumps where target > current
	WeakThreshold float64       // prune links weaker than this…
	IdleCutoff    time.Time     // …and un-activated since this
	Floor         float64       // …down to this weight (dim + severed, never deleted)
	ReknnLinks    []LinkUpsert  // re-KNN reconnection links (revive severed / create new)
}

// StageTarget is one star's radius-derived abstraction stage (spec 27 change 20): the count
// of gist_stage_radii thresholds its radius exceeds (0..4). RunConsolidation raises
// abstraction_stage to GREATEST(current, Stage) for stars where Stage > current.
type StageTarget struct {
	ID    string
	Stage int
}

// ReknnCandidate is one old isolated/severed star + its embedding for the nightly re-KNN
// reconnection pass (spec 27 change 20).
type ReknnCandidate struct {
	ID  string
	Vec []float32
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

// ConsolidateStar is one node for the server-side re-layout. Its raw Bjork fields
// (Intensity, RecallCount, LastRecalledAt) feed the change-18 radius the night uses for
// the re-stabilize/redistribute scope AND the abstraction-stage trigger; the cached stable
// coordinate (nil = never cached → cold seed) is a re-entry cache, not authority (§3).
type ConsolidateStar struct {
	ID             string
	LastRecalledAt time.Time
	Intensity      float64 // change-18 radius: emotional consolidation term of storage strength S
	RecallCount    int     // change-18 radius: cumulative recall term of storage strength S
	StableX        *float64
	StableY        *float64
	StableZ        *float64
}

// ConsolidateLink is one weighted, undirected synapse for the re-layout springs + cluster
// derivation. LinkType drives the nightly reweight (temporal↓·semantic↑); Severed marks a
// pruned/broken link (re-KNN revives it); LastActivatedAt feeds the prune idle cutoff.
type ConsolidateLink struct {
	AID             string
	BID             string
	Weight          float64
	LinkType        string
	Severed         bool
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
// text (or the whole diary body when fragment_text is NULL). Valence/Intensity are the
// fragment's affect (change 21) — the new star's side of the link emotion-similarity term.
type MemoryForEmbed struct {
	UserID    string
	Text      string
	EntryDate time.Time
	Valence   float64
	Intensity float64
}

// Neighbor is one KNN candidate returned by GraphStore.KnnNearest. Valence/Intensity are the
// candidate's affect (change 21) — the neighbor's side of the link emotion-similarity term.
type Neighbor struct {
	MemoryID  string
	CosSim    float64
	EntryDate time.Time
	Valence   float64
	Intensity float64
}

// LinkUpsert is one normalized (a_id < b_id) semantic synapse to persist.
type LinkUpsert struct {
	AID    string
	BID    string
	Weight float64
	UserID string
}
