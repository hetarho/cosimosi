package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

// MemoryOrigin implements memory.ProvenanceReader: the creation facts the created/original baseline is
// synthesized from ([CC5][I2]) — the memory's created_universe_time and its immutable Diary body.
// Per-user scoped; a missing, other-user, or soft-deleted memory is the canonical not-found (§4).
func (s Store) MemoryOrigin(ctx context.Context, scope platform.UserScope, memoryID string) (memory.MemoryOrigin, error) {
	if err := s.ready(scope); err != nil {
		return memory.MemoryOrigin{}, err
	}
	row, err := s.queries.LoadMemoryProvenanceBaseline(ctx, dbgen.LoadMemoryProvenanceBaselineParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.MemoryOrigin{}, memory.ErrProvenanceMemoryNotFound
	}
	if err != nil {
		return memory.MemoryOrigin{}, err
	}
	return memory.MemoryOrigin{
		DiaryBody:           row.DiaryBody,
		CreatedUniverseTime: dateValue(row.CreatedUniverseTime),
	}, nil
}

// MemoryProvenanceHistory implements memory.ProvenanceReader: the appended variant rows for one memory
// in universe-time order (created_at tiebreak), per-user scoped. Read-only — the reconsolidation/
// semanticization append is the only writer of memory_provenance; this read adds no write.
func (s Store) MemoryProvenanceHistory(ctx context.Context, scope platform.UserScope, memoryID string) ([]memory.MemoryProvenance, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListMemoryProvenance(ctx, dbgen.ListMemoryProvenanceParams{
		UserID:           scope.UserID(),
		EpisodicMemoryID: memoryID,
	})
	if err != nil {
		return nil, err
	}
	entries := make([]memory.MemoryProvenance, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, memory.MemoryProvenance{
			ID:               row.ID,
			EpisodicMemoryID: memoryID,
			Kind:             memory.ProvenanceKind(row.Kind),
			Source:           memory.ProvenanceSource(row.Source),
			Text:             row.Text,
			UniverseTime:     dateValue(row.UniverseTime),
			CreatedAt:        timeValue(row.CreatedAt),
		})
	}
	return entries, nil
}
