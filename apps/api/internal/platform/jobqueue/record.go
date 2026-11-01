package jobqueue

import "time"

// Kind is an opaque persisted handler identity, owned by the producer context.
type Kind string

type Status string

const (
	StatusPending  Status = "pending"
	StatusRunning  Status = "running"
	StatusDone     Status = "done"
	StatusFailed   Status = "failed"
	StatusCanceled Status = "cancelled"
)

type TargetKind string

const (
	TargetMemory  TargetKind = "episodic_memory"
	TargetNeuron  TargetKind = "neuron"
	TargetRelease TargetKind = "release_group"
	TargetUser    TargetKind = "user"
)

// Target is identity/revision metadata indexed outside the payload. It lets
// Release cancel work without inspecting JSON and lets Sweep remove every queue
// trace before deleting the target aggregate. Revision is zero for identity-only
// lifecycle targets such as a release group.
type Target struct {
	Kind             TargetKind
	ID               string
	ExpectedRevision int64
}

type Record struct {
	ID                  string
	UserID              string
	Kind                Kind
	Payload             []byte
	Status              Status
	Attempts            int32
	NextRunAt           time.Time
	CreatedAt           time.Time
	DedupKey            *string
	Targets             []Target
	TerminalAt          *time.Time
	CanceledByReleaseID *string
	// LeaseGeneration is the fence token the worker holds for this claim; a terminal
	// transition matches only while it equals the row's current generation.
	LeaseGeneration int64
}

func (j Record) JobID() string {
	return j.ID
}

func (j Record) JobLeaseGeneration() int64 {
	return j.LeaseGeneration
}

func (j Record) JobUserID() string {
	return j.UserID
}

func (j Record) JobKind() string {
	return string(j.Kind)
}

func (j Record) JobAttempts() int32 {
	return j.Attempts
}
