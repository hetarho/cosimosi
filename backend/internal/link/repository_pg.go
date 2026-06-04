package link

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

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
			LastActivatedAt:   timeFromDB(row.LastActivatedAt),
		})
	}
	return out, nil
}

func timeFromDB(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}
