// Package job owns the async extraction + embedding pipeline: it claims the
// extract job the RecordMemory transaction enqueued (spec 21), fans the diary
// out into fragment stars via ai.Extractor (one embed job each), then embeds
// each fragment and writes the initial semantic synapses (specs 04/05). Domain
// types here are pure — no transport (proto) or persistence (sqlc/db) tags
// (constitution §5).
package job

// Status is a job lifecycle state stored in jobs.status.
type Status string

const (
	StatusPending Status = "pending"
	StatusRunning Status = "running"
	StatusDone    Status = "done"
	StatusFailed  Status = "failed"
)

// Kind is the job type stored in jobs.kind.
type Kind string

const (
	KindEmbed Kind = "embed"
	// KindExtract is the event-boundary extraction job (spec 20/21): RecordMemory
	// enqueues one per diary, and the worker fans the segments out into fragment
	// stars (1 diary → N memories), each with its own embed job.
	KindExtract Kind = "extract"
	// KindConsolidate is the nightly "universe sleep" job (spec 27): the nightly
	// ticker enqueues one per active user, and the worker runs the 4-pass
	// consolidation (re-stabilize → redistribute → gist → prune) over that user's
	// whole graph. Keyed by UserID (no per-star memory_id).
	KindConsolidate Kind = "consolidate"
	// KindRewrite is the reconsolidation content-rewrite job (spec 54): RecallMemory
	// enqueues one (best-effort, gated by abstraction_stage ≥ threshold + debounce) when a
	// sufficiently-abstracted star is re-viewed, and the worker re-tells its displayed text
	// via ai.Rewriter, appending the result to the append-only variant log. Keyed by MemoryID.
	KindRewrite Kind = "rewrite"
)

// Job is a claimed unit of work. Keying follows jobs' columns: an embed job
// carries MemoryID (the fragment star), an extract job carries RecordID (the
// fragments don't exist yet), a consolidate job (spec 27) carries UserID (a
// whole-graph nightly pass). Attempts is the count BEFORE this attempt; the
// worker uses it to compute the next backoff on failure.
type Job struct {
	ID       string
	Kind     Kind
	MemoryID string // embed jobs; empty otherwise
	RecordID string // extract jobs; empty otherwise
	UserID   string // consolidate jobs (spec 27); empty otherwise
	Attempts int
}
