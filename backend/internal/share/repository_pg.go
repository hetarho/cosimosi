package share

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/db/gen"
)

// pgRepository is the pgx/sqlc-backed Repository. The domain never sees pgtype/db tags
// (constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) GetByUser(ctx context.Context, userID string) (Settings, bool, error) {
	row, err := gen.New(r.pool).GetShareByUser(ctx, userID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return Settings{}, false, nil // never shared
	case err != nil:
		return Settings{}, false, fmt.Errorf("get share by user: %w", err)
	}
	return Settings{Enabled: row.Enabled, Slug: row.Slug, DisplayName: row.DisplayName}, true, nil
}

func (r *pgRepository) Upsert(ctx context.Context, userID, slug string, enabled bool, displayName string) (Settings, error) {
	row, err := gen.New(r.pool).UpsertShareSettings(ctx, gen.UpsertShareSettingsParams{
		UserID:      userID,
		Slug:        slug,
		Enabled:     enabled,
		DisplayName: displayName,
	})
	if err != nil {
		return Settings{}, fmt.Errorf("upsert share settings: %w", err)
	}
	return Settings{Enabled: row.Enabled, Slug: row.Slug, DisplayName: row.DisplayName}, nil
}

func (r *pgRepository) Rotate(ctx context.Context, userID, slug string) (Settings, bool, error) {
	row, err := gen.New(r.pool).RotateShareSlug(ctx, gen.RotateShareSlugParams{Slug: slug, UserID: userID})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return Settings{}, false, nil // no row → nothing to rotate
	case err != nil:
		return Settings{}, false, fmt.Errorf("rotate share slug: %w", err)
	}
	return Settings{Enabled: row.Enabled, Slug: row.Slug, DisplayName: row.DisplayName}, true, nil
}

func (r *pgRepository) UserBySlug(ctx context.Context, slug string) (string, string, bool, error) {
	row, err := gen.New(r.pool).GetShareUserBySlug(ctx, slug)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return "", "", false, nil // unknown or disabled slug → uniform NotFound at the service
	case err != nil:
		return "", "", false, fmt.Errorf("get share user by slug: %w", err)
	}
	return row.UserID, row.DisplayName, true, nil
}

func (r *pgRepository) ListStars(ctx context.Context, userID string) ([]StarLandscape, error) {
	rows, err := gen.New(r.pool).ListSharedStars(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list shared stars: %w", err)
	}
	out := make([]StarLandscape, 0, len(rows))
	for _, row := range rows {
		s := StarLandscape{ID: row.MemoryID}
		if row.Mood != nil {
			s.Mood = *row.Mood
		}
		if row.Intensity != nil {
			s.Intensity = float64(*row.Intensity)
		}
		if row.LastRecalledAt.Valid {
			s.LastRecalledAt = row.LastRecalledAt.Time
		}
		if row.CreatedAt.Valid {
			s.CreatedAt = row.CreatedAt.Time
		}
		out = append(out, s)
	}
	return out, nil
}

func (r *pgRepository) ListStarIDs(ctx context.Context, userID string) ([]string, error) {
	ids, err := gen.New(r.pool).ListSharedStarIDs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list shared star ids: %w", err)
	}
	return ids, nil
}

func (r *pgRepository) ListSynapses(ctx context.Context, userID string) ([]SynapseLandscape, error) {
	rows, err := gen.New(r.pool).ListSharedSynapses(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list shared synapses: %w", err)
	}
	out := make([]SynapseLandscape, 0, len(rows))
	for _, row := range rows {
		out = append(out, SynapseLandscape{AID: row.AID, BID: row.BID, Weight: float64(row.Weight)})
	}
	return out, nil
}
