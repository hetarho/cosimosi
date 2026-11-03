package memory

import (
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
)

type NeuronType string

// ContentCounts is memory's published non-content aggregate for one user. It belongs to the
// context vocabulary; the pg adapter only maps grouped SQL rows into it.
type ContentCounts struct {
	Diaries          int64
	EpisodicMemories int64
}

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

func AllNeuronTypes() []NeuronType {
	return []NeuronType{NeuronTypeSemantic, NeuronTypeSpatial, NeuronTypeEntity}
}

// Queue envelopes are neutral infrastructure; memory owns only its producer kinds.
const (
	JobKindEmbed       jobqueue.Kind = "embed"
	JobKindSemanticize jobqueue.Kind = "semanticize"
	JobKindConsolidate jobqueue.Kind = "consolidate"
	JobKindRetention   jobqueue.Kind = "retention_sweep"
)

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
	ID      string
	DiaryID string
	Name    string
	// SourceText is the diary passage this memory was encoded from, fixed at launch. It seeds
	// CurrentText and then stays put while CurrentText moves with reconsolidation ([R8a]), so
	// the created/original baseline in 변천사 still reads true after a rewrite. Empty for
	// memories launched before per-memory passages existed — those fall back to the Diary body.
	SourceText               string
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
	// ForgettingOffsetDays is the signed neighbor forgetting nudge, read into EffectiveElapsedDays.
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

type UniverseFacts struct {
	EpisodicMemories []EpisodicMemory
	Neurons          []NeuronWithConnectivity
	Activations      []NeuronActivation
	Synapses         []Synapse
	// UniverseClock is the stored universe_state clock, read in the same snapshot
	// as the facts so a concurrent launch cannot skew universe time against them;
	// nil = the clock row is not born yet (lazy birth).
	UniverseClock *time.Time
	// Revision is the universe's freshness counter read in the same snapshot (MEM-21); 0 when no
	// graph-mutating transaction has run. Never a domain fact.
	Revision int64
}
