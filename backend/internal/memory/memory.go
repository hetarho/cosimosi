// Package memory is the diary/star feature core: pure domain types plus the
// consumer-side interfaces its service depends on. It holds NO transport (proto)
// or persistence (sqlc/db) tags — those live in the handler and repository_pg
// adapters (constitution §5: domain is pure).
package memory

import (
	"context"
	"time"
)

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

// LinkReader is the consumer-defined view the memory service needs to compose a
// Universe. link.Service satisfies it. Defining it here (not importing link)
// keeps the dependency one-way: link → memory, never the reverse.
type LinkReader interface {
	ListByUser(ctx context.Context, userID string) ([]Synapse, error)
}
