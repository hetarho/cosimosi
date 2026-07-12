package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

// EpisodicMemoryGist implements memory.GistReader: the view use-case's standalone
// gist read ([R8]). Per-user scoped; a missing, other-user, or soft-deleted row is
// the canonical not-found (§4).
func (s Store) EpisodicMemoryGist(ctx context.Context, scope platform.UserScope, memoryID string) (memory.MemoryGist, error) {
	if err := s.ready(scope); err != nil {
		return memory.MemoryGist{}, err
	}
	row, err := s.queries.LoadEpisodicMemoryGist(ctx, dbgen.LoadEpisodicMemoryGistParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.MemoryGist{}, memory.ErrViewSemanticMemoryNotFound
	}
	if err != nil {
		return memory.MemoryGist{}, err
	}
	return memory.MemoryGist{
		SemanticStage:  row.SemanticStage,
		SemanticStages: semanticStagesPtr(row.SemanticStages),
	}, nil
}
