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
)

type JobStatus string

const (
	JobStatusPending JobStatus = "pending"
	JobStatusRunning JobStatus = "running"
	JobStatusDone    JobStatus = "done"
	JobStatusFailed  JobStatus = "failed"
)

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
	DeletedAt                *time.Time
}

type Neuron struct {
	ID        string
	Name      *string
	Type      NeuronType
	CreatedAt time.Time
	SealedAt  *time.Time
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
	ID        string
	UserID    string
	Kind      JobKind
	Payload   []byte
	Status    JobStatus
	Attempts  int32
	NextRunAt time.Time
	CreatedAt time.Time
}

func (j Job) JobID() string {
	return j.ID
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
}
