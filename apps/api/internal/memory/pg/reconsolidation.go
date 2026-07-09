package pg

import (
	"context"
	"errors"
	"fmt"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// ErrProvenanceKindInvalid rejects a provenance write whose kind is outside the closed enum, or the
// 'created' baseline that is synthesized at read and never stored.
var ErrProvenanceKindInvalid = errors.New("memory provenance requires a stored kind (semanticized|reconsolidated)")

// ErrProvenanceSourceInvalid rejects a provenance write whose source is outside the closed enum.
var ErrProvenanceSourceInvalid = errors.New("memory provenance requires a valid source (original|system|user)")

// AddForgettingOffset additively nudges the forgetting offset of a recalled memory's NEIGHBORS ([R5]):
// the caller passes the neighbor id set (the recalled memory itself is excluded — it recovers wholly
// [F5]) and the signed delta. An empty set is a no-op. The offset column is REAL, so the float64
// domain delta narrows to float32 at the write boundary.
func (s Store) AddForgettingOffset(ctx context.Context, scope platform.UserScope, memoryIDs []string, delta float64) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	return s.queries.AddForgettingOffset(ctx, dbgen.AddForgettingOffsetParams{
		Delta:     float32(delta),
		UserID:    scope.UserID(),
		MemoryIds: memoryIDs,
	})
}

// AppendMemoryProvenance appends one append-only 변천사 row ([R8a][D1]). kind/source are validated
// against the domain's closed enums before insert, and the read-synthesized 'created' baseline is
// refused so no event ever backfills it. There is no update or delete counterpart — retained rows are
// immutable [I1].
func (s Store) AppendMemoryProvenance(ctx context.Context, scope platform.UserScope, entry memory.MemoryProvenance) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if !entry.Kind.Valid() || entry.Kind == memory.ProvenanceKindCreated {
		return fmt.Errorf("%w: %q", ErrProvenanceKindInvalid, entry.Kind)
	}
	if !entry.Source.Valid() {
		return fmt.Errorf("%w: %q", ErrProvenanceSourceInvalid, entry.Source)
	}
	return s.queries.AppendMemoryProvenance(ctx, dbgen.AppendMemoryProvenanceParams{
		ID:               entry.ID,
		UserID:           scope.UserID(),
		EpisodicMemoryID: entry.EpisodicMemoryID,
		Kind:             string(entry.Kind),
		Source:           string(entry.Source),
		Text:             entry.Text,
		UniverseTime:     pgDate(entry.UniverseTime),
	})
}
