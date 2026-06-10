// Package memory is the diary/star feature core: pure domain types plus the
// consumer-side interfaces its service depends on. It holds NO transport (proto)
// or persistence (sqlc/db) tags — those live in the handler and repository_pg
// adapters (constitution §5: domain is pure).
package memory

import (
	"context"
	"errors"
	"time"
)

// Validation sentinels for the write path. records are append-only (constitution
// §1), so rejecting invalid input BEFORE the transaction is the only defense —
// there is no cleanup path afterwards. The handler maps these to InvalidArgument.
// ⚠️ The FE substring-matches these MESSAGE TEXTS to pick Korean copy
// (frontend/src/features/record-memory/api/record-memory.ts) — rewording one
// breaks that mapping silently; service_test.go pins the matched substrings.
var (
	ErrEmptyBody      = errors.New("memory: body is empty")
	ErrBodyTooLong    = errors.New("memory: body exceeds max length")
	ErrIntensityRange = errors.New("memory: intensity out of range [0,1]")
)

// MaxBodyRunes caps the diary body length. It MIRRORS (must stay in sync with)
// the embedder input cap ai/openai.go maxInputRunes: anything longer would be
// silently truncated before embedding, so the star's semantic position would
// ignore the tail — better to reject up front than embed half a diary. The FE
// error copy ("4000자") also assumes this value.
const MaxBodyRunes = 4000

// Mood is the domain mood, one of 7 fixed values (or empty = unspecified). It is
// stored as its lowercase string in records.mood (nullable) and mapped to/from
// the proto Mood enum in the handler. The empty Mood means "not set".
type Mood string

const (
	MoodUnspecified Mood = ""
	MoodJoy         Mood = "joy"
	MoodCalm        Mood = "calm"
	MoodSad         Mood = "sad"
	MoodAnger       Mood = "anger"
	MoodFear        Mood = "fear"
	MoodLove        Mood = "love"
	MoodNeutral     Mood = "neutral"
)

// RecordInput is what RecordMemory writes to the immutable records table
// (constitution §1). It is deliberately separate from the Memory (star) domain:
// the original diary text is persisted here and never mutated.
type RecordInput struct {
	UserID         string
	Body           string    // the diary original — kept forever in records
	EntryDate      time.Time // user-chosen moment (defaults to today)
	Mood           Mood      // optional (MoodUnspecified → stored NULL)
	Intensity      float64   // 0..1, optional (0 when unset)
	IdempotencyKey string    // optional; empty = not applied
}

// Memory is the star projection used by GetUniverse — no body, no entry_date.
// mood/intensity are sourced from records via JOIN; brightness/coordinates are
// NOT here (computed client-side, constitution §2·§3).
type Memory struct {
	ID             string // = memory_id
	Mood           Mood   // JOINed from records
	Intensity      float64
	LastRecalledAt *time.Time // activity basis for client brightness (04 never mutates it)
}

// Synapse is a weighted, undirected (a < b) link between two stars. Only weight
// is authoritative; thickness/brightness are derived in the client shader. This
// type lives in the memory package (not link) so the link reader can return it
// without the memory service importing link (avoids an import cycle).
type Synapse struct {
	AID, BID          string
	Weight            float64
	LinkType          string
	CoActivationCount int
	LastActivatedAt   *time.Time
}

// Universe is the whole authoritative graph for one user: every star and every
// synapse, dormant ones included (no brightness filter — constitution §2).
type Universe struct {
	Memories []Memory
	Synapses []Synapse
}

// LinkDelta is one co-recall reinforcement increment for a star pair.
type LinkDelta struct {
	AID, BID    string
	DeltaWeight float64
}

// Record is the immutable original diary, read on recall (constitution §1). Sourced
// from the records table (not memories — the star carries no body).
type Record struct {
	Body      string
	EntryDate time.Time
	Mood      Mood
	Intensity float64
	CreatedAt time.Time
}

// LinkService is the consumer-defined synapse port the memory service needs: read
// (compose a Universe) + co-recall reinforcement (spec 11). link.Service satisfies
// it. Defining it here (not importing link) keeps the dependency one-way:
// link → memory, never the reverse.
type LinkService interface {
	ListByUser(ctx context.Context, userID string) ([]Synapse, error)
	ReinforceLinks(ctx context.Context, userID, batchID string, deltas []LinkDelta) error
}
