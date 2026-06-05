// Package job owns the async embedding pipeline: it claims jobs the RecordMemory
// transaction enqueued (spec 04), embeds the diary, stores the vector, and writes
// the initial semantic synapses (spec 05). Domain types here are pure — no
// transport (proto) or persistence (sqlc/db) tags (constitution §5).
package job

// Status is a job lifecycle state stored in jobs.status.
type Status string

const (
	StatusPending Status = "pending"
	StatusRunning Status = "running"
	StatusDone    Status = "done"
	StatusFailed  Status = "failed"
)

// Kind is the job type stored in jobs.kind. MVP has one: embed.
type Kind string

const KindEmbed Kind = "embed"

// Job is a claimed unit of work. Attempts is the count BEFORE this attempt; the
// worker uses it to compute the next backoff on failure.
type Job struct {
	ID       string
	MemoryID string
	Attempts int
}
