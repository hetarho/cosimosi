package link

import (
	"context"

	"github.com/cosimosi/backend/internal/memory"
)

// Repository is the read-only persistence port for the synapse graph (the pgx
// implementation is in repository_pg.go). Scoped to one user (memory_links.user_id).
type Repository interface {
	// ListByUser returns every synapse for the user — dormant ones included, no
	// weight filter (constitution §2).
	ListByUser(ctx context.Context, userID string) ([]memory.Synapse, error)

	// ReinforceLinks applies one co-recall batch idempotently by batchID: if the
	// batch was already applied it's a no-op; otherwise each pair's weight increases
	// by its delta (capped 1.0) and the batch is marked processed — all in one tx
	// (spec 11). Pairs are pre-normalized a<b by the caller; the SQL re-normalizes
	// with LEAST/GREATEST under the DB collation.
	ReinforceLinks(ctx context.Context, userID, batchID string, aIDs, bIDs []string, deltas []float64) error
}
