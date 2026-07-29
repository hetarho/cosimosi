package store

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// The store reads' consumer-owned ports (§2.4/§2.9#6), split the way the two tables are: permanent
// ownership history, and the one applied row per kind. Domain-shaped in and out — no sqlc row, pgx
// handle or proto type crosses either of them, and the concretes live in store/pg. The purge port is
// separate (purge.go) because its two deletes are one transaction.

// OwnershipStore is the permanent-ownership surface: what the caller owns, and the append that
// records one more. There is deliberately no update and no revoke method — ownership has neither
// ([P9]).
//
// InsertOrnamentOwnership answers whether THIS call acquired the row (false = the user already owned
// it). That boolean is what a save's charge is summed over, so the price can never be taken from a
// preceding read two concurrent saves would both pass.
type OwnershipStore interface {
	ListOrnamentOwnerships(ctx context.Context, scope platform.UserScope) ([]OrnamentOwnership, error)
	InsertOrnamentOwnership(ctx context.Context, scope platform.UserScope, ornamentID OrnamentID, acquiredVia OrnamentAcquisition) (acquired bool, err error)
}

// SelectionStore is what the universe wears.
type SelectionStore interface {
	ListOrnamentSelections(ctx context.Context, scope platform.UserScope) ([]OrnamentSelection, error)
}

// DecorateTx is the save's transaction surface, and it is deliberately narrow: it can acquire, apply
// and revert-to-default, and that is all. There is **no ownership delete** on it, so a refund, an
// expiry or a re-purchase is not something the save could do wrong — it cannot express them ([P9][I1]).
// It carries no ledger method either: the debit reaches the same transaction through SpendGate, so
// `store` never learns what a balance is.
type DecorateTx interface {
	OwnershipStore
	SelectionStore
	UpsertOrnamentSelection(ctx context.Context, scope platform.UserScope, selection OrnamentSelection) error
	DeleteOrnamentSelection(ctx context.Context, scope platform.UserScope, kind OrnamentKind) error
}

// DecorateRepo runs one save inside one transaction. The purchase, the applied rows and the Twinkle
// debit commit together or not at all ([P8]).
type DecorateRepo interface {
	InDecorateTx(ctx context.Context, fn func(tx DecorateTx) error) error
}

// EconomyTx is the open transaction handed to the spend gate, opaque on purpose: only the composition
// root knows the concrete, so `store` cannot reach into the ledger and `twinkle` is not imported here.
type EconomyTx any

// PurchaseSpend is what a save asks the economy for. It has **no kind, no tier and no reason field**:
// `store` cannot ask for a SMALL draw and cannot claim to be a recall, so [P9] holds at the type level
// before any spend planner or DB CHECK runs. The amount is the catalog's, and the dedup key makes a
// retried save charge once.
type PurchaseSpend struct {
	Amount   int
	DedupKey string
}

// SpendGate is the one cross-context edge a save has. The concrete is bound at the composition root
// over the Twinkle economy, onto this save's own transaction.
type SpendGate interface {
	CheckAndSpend(ctx context.Context, scope platform.UserScope, tx EconomyTx, spend PurchaseSpend) error
}

// AchievementRecorder is how a save reports progress: a counter key and a delta, inside the same
// transaction. The payload has no field for a memory id, a strength, a mood or any text, which is how
// "achievements touch no meaning field" holds structurally rather than by review ([A6][I11]).
type AchievementRecorder interface {
	RecordProgress(ctx context.Context, scope platform.UserScope, tx EconomyTx, counterKey string, delta int) error
}

// NoAchievementRecorder is the shipped default: a save records nothing until the achievement context
// binds the concrete. Counting is not a precondition for decorating.
type NoAchievementRecorder struct{}

func (NoAchievementRecorder) RecordProgress(
	context.Context,
	platform.UserScope,
	EconomyTx,
	string,
	int,
) error {
	return nil
}
