package link

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	dbutil "github.com/cosimosi/backend/internal/db"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/memory"
)

// pgRepository is the pgx/sqlc-backed read-only synapse Repository.
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production read Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

// ListByUser maps sqlc link rows → memory.Synapse, scoped to the user. Raw weight
// and last_activated_at are passed through; brightness is a client concern (§2).
func (r *pgRepository) ListByUser(ctx context.Context, userID string) ([]memory.Synapse, error) {
	rows, err := gen.New(r.pool).ListLinksByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list links: %w", err)
	}
	out := make([]memory.Synapse, 0, len(rows))
	for _, row := range rows {
		out = append(out, memory.Synapse{
			AID:               row.AID,
			BID:               row.BID,
			Weight:            float64(row.Weight),
			LinkType:          row.LinkType,
			CoActivationCount: int(row.CoActivationCount),
			LastActivatedAt:   dbutil.TimePtr(row.LastActivatedAt),
		})
	}
	return out, nil
}

// ReinforceLinks applies one batch in a single transaction: CLAIM the batch_id first
// (the insert holds the PK lock for the whole tx), and only upsert the increments if
// this tx won the claim. A duplicate/concurrent batch_id blocks on the claim, then
// gets 0 rows and skips — true serialization, no double count (spec 11, 1.5/1.10).
func (r *pgRepository) ReinforceLinks(ctx context.Context, userID, batchID string, aIDs, bIDs []string, deltas []float64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)
	claimed, err := q.ClaimBatch(ctx, gen.ClaimBatchParams{BatchID: batchID, UserID: userID})
	if err != nil {
		return fmt.Errorf("claim batch: %w", err)
	}
	if claimed == 0 {
		return nil // already processed — idempotent skip (commit is a no-op, defer rolls back)
	}
	if len(aIDs) > 0 {
		if err := q.ReinforceLinks(ctx, gen.ReinforceLinksParams{
			UserID: userID, AIds: aIDs, BIds: bIDs, Deltas: deltas,
		}); err != nil {
			return fmt.Errorf("reinforce links: %w", err)
		}
	}
	return tx.Commit(ctx)
}
