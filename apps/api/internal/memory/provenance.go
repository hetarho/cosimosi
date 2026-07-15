package memory

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// GetProvenance use-case ([R8a][D1]) — the read-only 변천사 (variant history) of one memory: the
// synthesized created/original baseline first, then every appended representational event in
// universe-time order. It is the read half of the trace-vs-record contrast ([D4]): the history records
// only the representation's evolution, while the objective Diary is reached only through Export and the
// reader ([I2]). Read-only — it advances no clock ([T3]), appends no row ([CC5]), and spends no stardust
// (metadata tier [R1][G1]); it carries no SpendGate call.

var (
	// ErrProvenanceInputRequired rejects an empty target memory id.
	ErrProvenanceInputRequired = errors.New("get provenance requires a target memory id")
	// ErrProvenanceMemoryNotFound is returned when the target is not the caller's, does not
	// exist, or is soft-deleted — no cross-user leak, and a deleted memory's history is not opened (§4).
	ErrProvenanceMemoryNotFound = errors.New("get provenance target memory not found")
)

// ProvenanceEntry is one entry in a memory's read-time variant history: the representation text at one
// event, tagged kind × source and anchored in universe-time. The baseline (created/original) is
// synthesized; the rest mirror the appended memory_provenance rows. No distortion flag — distortion is
// found by reading the list, not announced ([R8a]).
type ProvenanceEntry struct {
	Kind         ProvenanceKind
	Source       ProvenanceSource
	Text         string
	UniverseTime time.Time
}

// MemoryOrigin holds the creation facts the created/original baseline is synthesized from: the
// immutable Diary body (the objective record via diary_id, [I2][D4]) and the memory's creation
// universe-time. It is never current_text and never a stored memory_provenance row ([CC5][A2]).
type MemoryOrigin struct {
	DiaryBody           string
	CreatedUniverseTime time.Time
}

// ProvenanceReader is the GetProvenance use-case's consumer-owned read port (§2.4): the baseline
// creation facts and the appended history rows, per-user scoped, read-only. The concrete is memory/pg,
// which implements this implicitly.
type ProvenanceReader interface {
	// MemoryOrigin loads one memory's creation facts (Diary body + created universe-time), per-user
	// scoped; another user's or a soft-deleted memory returns ErrProvenanceMemoryNotFound.
	MemoryOrigin(ctx context.Context, scope platform.UserScope, memoryID string) (MemoryOrigin, error)
	// MemoryProvenanceHistory lists the appended variant rows for one memory in universe-time order
	// (created_at tiebreak), per-user scoped. Empty when it has never been reconsolidated/semanticized.
	MemoryProvenanceHistory(ctx context.Context, scope platform.UserScope, memoryID string) ([]MemoryProvenance, error)
}

// GetProvenance returns one memory's variant history: load the creation facts (per-user scoped) →
// synthesize the created/original baseline from the immutable Diary body → prepend it to the appended
// rows (already universe-time ordered). The baseline is the earliest event ([T]), so prepending it is
// the time order the panel renders ([R8a], A1). No write, no clock, no spend (A6).
func (s *Service) GetProvenance(ctx context.Context, scope platform.UserScope, memoryID string) ([]ProvenanceEntry, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	if memoryID == "" {
		return nil, ErrProvenanceInputRequired
	}
	origin, err := s.provenance.MemoryOrigin(ctx, scope, memoryID)
	if err != nil {
		return nil, err
	}
	rows, err := s.provenance.MemoryProvenanceHistory(ctx, scope, memoryID)
	if err != nil {
		return nil, err
	}
	entries := make([]ProvenanceEntry, 0, len(rows)+1)
	entries = append(entries, ProvenanceEntry{
		Kind:         ProvenanceKindCreated,
		Source:       ProvenanceSourceOriginal,
		Text:         origin.DiaryBody,
		UniverseTime: origin.CreatedUniverseTime,
	})
	for _, row := range rows {
		entries = append(entries, ProvenanceEntry{
			Kind:         row.Kind,
			Source:       row.Source,
			Text:         row.Text,
			UniverseTime: row.UniverseTime,
		})
	}
	return entries, nil
}
