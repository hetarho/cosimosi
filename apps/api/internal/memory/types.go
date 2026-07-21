package memory

import "time"

type NeuronType string

const (
	NeuronTypeSemantic NeuronType = "semantic"
	NeuronTypeSpatial  NeuronType = "spatial"
	NeuronTypeEntity   NeuronType = "entity"
)

// Valid reports whether t is one of the three canonical neuron types [E3] —
// the single owner of the valid-type set for both the domain and the adapters.
func (t NeuronType) Valid() bool {
	switch t {
	case NeuronTypeSemantic, NeuronTypeSpatial, NeuronTypeEntity:
		return true
	default:
		return false
	}
}

type JobKind string

const (
	JobKindEmbed       JobKind = "embed"
	JobKindSemanticize JobKind = "semanticize"
	JobKindLink        JobKind = "link"
	JobKindExtract     JobKind = "extract"
	JobKindConsolidate JobKind = "consolidate"
	JobKindRetention   JobKind = "retention_sweep"
)

type JobStatus string

const (
	JobStatusPending  JobStatus = "pending"
	JobStatusRunning  JobStatus = "running"
	JobStatusDone     JobStatus = "done"
	JobStatusFailed   JobStatus = "failed"
	JobStatusCanceled JobStatus = "cancelled"
)

type JobTargetKind string

const (
	JobTargetMemory  JobTargetKind = "episodic_memory"
	JobTargetNeuron  JobTargetKind = "neuron"
	JobTargetRelease JobTargetKind = "release_group"
)

// JobTarget is identity/revision metadata indexed outside the payload. It lets
// Release cancel work without inspecting JSON and lets Sweep remove every queue
// trace before deleting the target aggregate. Revision is zero for identity-only
// lifecycle targets such as a release group.
type JobTarget struct {
	Kind             JobTargetKind
	ID               string
	ExpectedRevision int64
}

// ProvenanceKind labels a representational event in a memory's 변천사 ([R8a][D1]).
// 'created' is never written — it is synthesized at read from the memory's
// creation facts; reconsolidation appends 'reconsolidated', and gist rise appends
// 'semanticized'. A closed enum stored as TEXT, validated by the domain before
// insert (matching NeuronType/JobKind, not a PG enum type).
type ProvenanceKind string

const (
	ProvenanceKindCreated        ProvenanceKind = "created"
	ProvenanceKindSemanticized   ProvenanceKind = "semanticized"
	ProvenanceKindReconsolidated ProvenanceKind = "reconsolidated"
)

func (k ProvenanceKind) Valid() bool {
	switch k {
	case ProvenanceKindCreated, ProvenanceKindSemanticized, ProvenanceKindReconsolidated:
		return true
	default:
		return false
	}
}

// ProvenanceSource records who authored a representational event: 'original' the
// diarist's launched account (the synthesized baseline), 'system' the AI (gist),
// 'user' a recall rewrite. Closed enum, TEXT, domain-validated.
type ProvenanceSource string

const (
	ProvenanceSourceOriginal ProvenanceSource = "original"
	ProvenanceSourceSystem   ProvenanceSource = "system"
	ProvenanceSourceUser     ProvenanceSource = "user"
)

func (s ProvenanceSource) Valid() bool {
	switch s {
	case ProvenanceSourceOriginal, ProvenanceSourceSystem, ProvenanceSourceUser:
		return true
	default:
		return false
	}
}

// MemoryProvenance is one append-only 변천사 row ([R8a][D1]): a memory's
// representation text at one event, tagged by kind × source and anchored in
// universe-time. Appended, never mutated ([I1]); the 'created'/'original'
// baseline is synthesized at read, never stored. CreatedAt is DB-assigned on
// insert (the deterministic tiebreak for same-universe-day events).
type MemoryProvenance struct {
	ID               string
	EpisodicMemoryID string
	Kind             ProvenanceKind
	Source           ProvenanceSource
	Text             string
	UniverseTime     time.Time
	// SemanticStage identifies which gist stage a semanticized event materialized
	// (1..semanticMaxStage). The database holds exactly one event per stage and
	// refuses a blank text with it, so a replayed writer cannot duplicate or blank
	// the history. Nil on every other kind (and on legacy semanticized rows).
	SemanticStage *int16
	CreatedAt     time.Time
}

type Diary struct {
	ID        string
	Body      string
	DiaryDate time.Time
	CreatedAt time.Time
}

type EpisodicMemory struct {
	ID                       string
	DiaryID                  string
	Name                     string
	CurrentText              string
	Seed                     *int64
	Emotion                  Emotion
	BaseStrength             float64
	RecallCount              int32
	CreatedUniverseTime      time.Time
	LastRecalledUniverseTime *time.Time
	SemanticStage            int16
	SemanticizeTimerResetAt  *time.Time
	SemanticStages           *SemanticStages
	// PendingSemanticStage is a gist rise the timer already crossed whose ladder
	// text is still missing: the visible SemanticStage stays authoritative until
	// the semanticize completion materializes the rise with real text.
	// PendingSemanticRiseAt is the crossing's universe-time — the event time the
	// finalized provenance rows carry. Both nil when nothing is pending.
	PendingSemanticStage  *int16
	PendingSemanticRiseAt *time.Time
	// DecayStages holds the stored per-stage word-loss texts ([R8a]); the read returns them so the
	// client shows the persisted fragment for the current stage. Nil until a stage text is filled.
	DecayStages []string
	// ForgettingOffsetDays is the signed neighbor forgetting nudge (CC4), read into EffectiveElapsedDays.
	ForgettingOffsetDays float64
	DeletedAt            *time.Time
	// RepresentationRevision changes whenever the authoritative source representation
	// is rewritten. Async work captures it and may publish only while it still matches.
	RepresentationRevision int64
}

type Neuron struct {
	ID                     string
	Name                   *string
	Type                   NeuronType
	CreatedAt              time.Time
	SealedAt               *time.Time
	RepresentationRevision int64
}

type NeuronWithConnectivity struct {
	Neuron
	Connectivity int32
}

type NeuronActivation struct {
	EpisodicMemoryID string
	NeuronID         string
	Weight           float32
}

type Synapse struct {
	ID                        string
	NeuronAID                 string
	NeuronBID                 string
	Strength                  float32
	CoActivationCount         int32
	LastActivatedUniverseTime time.Time
	CreatedAt                 time.Time
}

type Embedding struct {
	NeuronID string
	Vector   []float32
}

type SemanticStages [4]string

type Job struct {
	ID                  string
	UserID              string
	Kind                JobKind
	Payload             []byte
	Status              JobStatus
	Attempts            int32
	NextRunAt           time.Time
	CreatedAt           time.Time
	DedupKey            *string
	Targets             []JobTarget
	TerminalAt          *time.Time
	CanceledByReleaseID *string
	// LeaseGeneration is the fence token the worker holds for this claim; a terminal
	// transition matches only while it equals the row's current generation.
	LeaseGeneration int64
}

func (j Job) JobID() string {
	return j.ID
}

func (j Job) JobLeaseGeneration() int64 {
	// Retention work is the sole durable trigger for an inactive user's explicit
	// Release. It retries past the generic dead-letter claim ceiling; the actual
	// LeaseGeneration field still fences its database operations.
	if j.Kind == JobKindRetention {
		return 0
	}
	return j.LeaseGeneration
}

func (j Job) JobUserID() string {
	return j.UserID
}

func (j Job) JobKind() string {
	return string(j.Kind)
}

func (j Job) JobAttempts() int32 {
	return j.Attempts
}

type UniverseFacts struct {
	EpisodicMemories []EpisodicMemory
	Neurons          []NeuronWithConnectivity
	Activations      []NeuronActivation
	Synapses         []Synapse
	// UniverseClock is the stored universe_state clock, read in the same snapshot
	// as the facts so a concurrent launch cannot skew universe time against them;
	// nil = the clock row is not born yet (lazy birth).
	UniverseClock *time.Time
}
