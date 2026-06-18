// Package settings is per-user visual personalization (spec 30) + the customization economy
// (spec 44): four selection axes (background theme · star object · self object · synapse style),
// per-mood star colors, plus a 별가루 wallet and owned-item set that gate paid items. The server
// stores only the user's OVERRIDES + authoritative wallet/ownership — the client owns the default
// catalog (it needs it for the unauth/offline path) and merges these over it. A separate bounded
// context from the star graph (internal/memory), hence its own SettingsService.
package settings

import (
	"context"
	"errors"
)

// Validation / control sentinels — the handler maps these to Connect codes (the spec-17 pattern),
// so the rejection reason reaches the client.
var (
	ErrInvalidColor = errors.New("settings: color must be #RRGGBB")
	ErrInvalidMood  = errors.New("settings: unknown mood")
	// ErrUnknownItem — an item id not in the catalog (neither a free axis kind nor a priced
	// paid item). Replaces the spec-30 ErrInvalidTheme/ErrInvalidObject (now one 4-axis check).
	ErrUnknownItem = errors.New("settings: unknown item")
	// ErrItemFree — PurchaseItem was asked to buy a free kind (free is implicit ownership, A2a).
	ErrItemFree = errors.New("settings: item is free")
	// ErrAlreadyOwned — the user already owns this paid item (no double debit, A2b).
	ErrAlreadyOwned = errors.New("settings: item already owned")
	// ErrInsufficientFunds — balance < price (A2c); the debit is rejected, no row changes.
	ErrInsufficientFunds = errors.New("settings: insufficient stardust")
	// ErrNotOwned — UpdateSettings tried to select a paid item the user doesn't own (A4).
	ErrNotOwned = errors.New("settings: item not owned")
)

// EmotionColor is one mood→color override. Mood is the lowercase enum name
// ("joy".."emptiness", spec 29); Color is "#RRGGBB".
type EmotionColor struct {
	Mood  string
	Color string
}

// Settings is a user's stored visual overrides — NOT a complete config. Empty axis fields mean
// "not overridden" (the client falls back to its axis default). The four axes (spec 44): Theme =
// background, StarObject = star, SelfObject = self, SynapseStyle = synapse.
type Settings struct {
	Theme         string
	StarObject    string
	SelfObject    string
	SynapseStyle  string
	EmotionColors []EmotionColor
}

// Patch is a partial update: a nil pointer means "field not sent — preserve it";
// EmotionColors is the subset of moods to upsert (it never deletes the others).
type Patch struct {
	Theme         *string
	StarObject    *string
	SelfObject    *string
	SynapseStyle  *string
	EmotionColors []EmotionColor
}

// Wallet is the user's 별가루 balance (authoritative — the client never decides money).
type Wallet struct {
	Stardust int
}

// Inventory is the wallet balance + the set of OWNED paid item ids (free kinds are NOT listed —
// implicit ownership; the client knows them from its catalog). Item ids are "<axis>:<kind>".
type Inventory struct {
	Stardust     int
	OwnedItemIDs []string
}

// Repository is the persistence port (pgx impl in repository_pg.go). There is no delete —
// overrides and ownership are only added or changed; the wallet only debits (never resets).
type Repository interface {
	// Get returns the user's stored overrides (zero-value Settings if none).
	Get(ctx context.Context, userID string) (Settings, error)
	// Update upserts the patch's present fields in one transaction.
	Update(ctx context.Context, userID string, p Patch) error
	// GetInventory seeds the wallet on first read (starting balance) and returns balance + owned
	// items in one transaction. Seeding is idempotent — an existing balance is never changed.
	GetInventory(ctx context.Context, userID string, startingStardust int) (Inventory, error)
	// ListOwned returns the user's owned paid item ids WITHOUT seeding the wallet — the
	// selection-ownership check (A4) needs only ownership, and must not mutate any row on a
	// rejected UpdateSettings.
	ListOwned(ctx context.Context, userID string) ([]string, error)
	// Purchase atomically debits price and grants the item in one transaction, returning the new
	// inventory. startingStardust seeds the wallet first if the user has none (so a never-seeded
	// buyer is charged against the real starting balance, not a free ride). It maps the failure
	// cases to sentinels with NO partial application (A2): ErrInsufficientFunds (balance < price)
	// and ErrAlreadyOwned (already owned) both roll back.
	Purchase(ctx context.Context, userID, itemID string, price, startingStardust int) (Inventory, error)
}
