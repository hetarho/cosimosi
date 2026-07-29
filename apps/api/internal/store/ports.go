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
type OwnershipStore interface {
	ListOrnamentOwnerships(ctx context.Context, scope platform.UserScope) ([]OrnamentOwnership, error)
	InsertOrnamentOwnership(ctx context.Context, scope platform.UserScope, ornamentID OrnamentID, acquiredVia OrnamentAcquisition) error
}

// SelectionStore is what the universe wears. The write is not here: applying an ornament is one
// transaction with its purchase, so the upsert is composed by the Decorate use-case over its own
// transaction handle rather than reached through this read port.
type SelectionStore interface {
	ListOrnamentSelections(ctx context.Context, scope platform.UserScope) ([]OrnamentSelection, error)
}
