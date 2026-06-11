package settings

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/db/gen"
)

// pgRepository is the pgx/sqlc-backed Repository. The domain never sees pgtype/db
// tags (constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

// Get reads the user's single-value overrides (theme/object) and per-mood color
// overrides. Absent rows are normal — the client merges its defaults over what's here.
func (r *pgRepository) Get(ctx context.Context, userID string) (Settings, error) {
	q := gen.New(r.pool)

	var s Settings
	row, err := q.GetUserSettings(ctx, userID)
	switch {
	case err == nil:
		s.Theme = derefStr(row.Theme)
		s.StarObject = derefStr(row.StarObject)
	case errors.Is(err, pgx.ErrNoRows):
		// No single-value overrides yet — leave empty (client uses its defaults).
	default:
		return Settings{}, fmt.Errorf("get user settings: %w", err)
	}

	colors, err := q.ListUserEmotionColors(ctx, userID)
	if err != nil {
		return Settings{}, fmt.Errorf("list emotion colors: %w", err)
	}
	for _, c := range colors {
		s.EmotionColors = append(s.EmotionColors, EmotionColor{Mood: c.Mood, Color: c.Color})
	}
	return s, nil
}

// Update upserts the patch in one transaction: the single-value row only when
// theme/object is present (so a colors-only update doesn't create an empty row),
// then each emotion color. A failure leaves no partial rows.
func (r *pgRepository) Update(ctx context.Context, userID string, p Patch) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	q := gen.New(tx)

	if p.Theme != nil || p.StarObject != nil {
		if err := q.UpsertUserSettings(ctx, gen.UpsertUserSettingsParams{
			UserID:     userID,
			Theme:      p.Theme,
			StarObject: p.StarObject,
		}); err != nil {
			return fmt.Errorf("upsert user settings: %w", err)
		}
	}
	for _, c := range p.EmotionColors {
		if err := q.UpsertUserEmotionColor(ctx, gen.UpsertUserEmotionColorParams{
			UserID: userID,
			Mood:   c.Mood,
			Color:  c.Color,
		}); err != nil {
			return fmt.Errorf("upsert emotion color: %w", err)
		}
	}
	return tx.Commit(ctx)
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
