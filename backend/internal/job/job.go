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
)

// Job is a claimed unit of work. Keying follows jobs' columns: an embed job
// carries MemoryID (the fragment star), an extract job carries RecordID (the
// fragments don't exist yet). Attempts is the count BEFORE this attempt; the
// worker uses it to compute the next backoff on failure.
type Job struct {
	ID       string
	Kind     Kind
	MemoryID string // embed jobs; empty for extract
	RecordID string // extract jobs; empty for embed
	Attempts int
}
