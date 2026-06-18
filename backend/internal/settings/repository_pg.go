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

// Get reads the user's single-value overrides (4-axis selection) and per-mood color overrides.
// Absent rows are normal — the client merges its defaults over what's here.
func (r *pgRepository) Get(ctx context.Context, userID string) (Settings, error) {
	q := gen.New(r.pool)

	var s Settings
	row, err := q.GetUserSettings(ctx, userID)
	switch {
	case err == nil:
		s.Theme = derefStr(row.Theme)
		s.StarObject = derefStr(row.StarObject)
		s.SelfObject = derefStr(row.SelfObject)
		s.SynapseStyle = derefStr(row.SynapseStyle)
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

// Update upserts the patch in one transaction: the single-value row only when an axis selection
// is present (so a colors-only update doesn't create an empty row), then each emotion color. A
// failure leaves no partial rows.
func (r *pgRepository) Update(ctx context.Context, userID string, p Patch) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	q := gen.New(tx)

	if hasAxisSelection(p) {
		if err := q.UpsertUserSettings(ctx, gen.UpsertUserSettingsParams{
			UserID:       userID,
			Theme:        p.Theme,
			StarObject:   p.StarObject,
			SelfObject:   p.SelfObject,
			SynapseStyle: p.SynapseStyle,
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

// GetInventory seeds the wallet (idempotent) then reads balance + owned items in one transaction
// (A1). SeedWallet INSERTs starting_stardust only when the row is absent; an existing balance is
// returned unchanged.
func (r *pgRepository) GetInventory(ctx context.Context, userID string, startingStardust int) (Inventory, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Inventory{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	q := gen.New(tx)

	stardust, err := q.SeedWallet(ctx, gen.SeedWalletParams{UserID: userID, Stardust: int32(startingStardust)})
	if err != nil {
		return Inventory{}, fmt.Errorf("seed wallet: %w", err)
	}
	owned, err := q.ListOwnedItems(ctx, userID)
	if err != nil {
		return Inventory{}, fmt.Errorf("list owned items: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Inventory{}, fmt.Errorf("commit: %w", err)
	}
	return Inventory{Stardust: int(stardust), OwnedItemIDs: owned}, nil
}

// ListOwned reads the user's owned paid item ids without seeding the wallet (the ownership check
// for UpdateSettings must not write any row on a rejected patch). Free kinds are not stored.
func (r *pgRepository) ListOwned(ctx context.Context, userID string) ([]string, error) {
	owned, err := gen.New(r.pool).ListOwnedItems(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list owned items: %w", err)
	}
	return owned, nil
}

// Purchase atomically debits price and grants the item (A2): SeedWallet (ensure the row exists) →
// DebitWallet (affected=0 → insufficient funds; the WHERE stardust >= amount guard also prevents
// a negative balance) → GrantItem (affected=0 → already owned; the rollback undoes the debit, no
// double charge) → re-read → commit. Any sentinel rolls the whole transaction back.
func (r *pgRepository) Purchase(ctx context.Context, userID, itemID string, price, startingStardust int) (Inventory, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Inventory{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	q := gen.New(tx)

	// Seed to the STARTING balance if the row is absent (idempotent — an existing balance is
	// untouched), so a never-seeded buyer is charged against 100, never a free ride.
	if _, err := q.SeedWallet(ctx, gen.SeedWalletParams{UserID: userID, Stardust: int32(startingStardust)}); err != nil {
		return Inventory{}, fmt.Errorf("seed wallet: %w", err)
	}
	debited, err := q.DebitWallet(ctx, gen.DebitWalletParams{Amount: int32(price), UserID: userID})
	if err != nil {
		return Inventory{}, fmt.Errorf("debit wallet: %w", err)
	}
	if debited == 0 {
		return Inventory{}, ErrInsufficientFunds // rolled back by deferred Rollback
	}
	granted, err := q.GrantItem(ctx, gen.GrantItemParams{UserID: userID, ItemID: itemID})
	if err != nil {
		return Inventory{}, fmt.Errorf("grant item: %w", err)
	}
	if granted == 0 {
		return Inventory{}, ErrAlreadyOwned // rolled back — the debit is undone
	}

	stardust, err := q.GetWallet(ctx, userID)
	if err != nil {
		return Inventory{}, fmt.Errorf("get wallet: %w", err)
	}
	owned, err := q.ListOwnedItems(ctx, userID)
	if err != nil {
		return Inventory{}, fmt.Errorf("list owned items: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Inventory{}, fmt.Errorf("commit: %w", err)
	}
	return Inventory{Stardust: int(stardust), OwnedItemIDs: owned}, nil
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
