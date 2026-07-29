// Package pg is the store context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete store over
// ornament_ownerships + ornament_selections, with the row↔domain mapping at this edge — no dbgen row
// escapes inward. It declares no repository interface: the ports are consumer-owned by the store
// reads (construct a Store over a transaction handle with NewStore to compose a write into one).
package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
	"github.com/jackc/pgx/v5"
)

var (
	ErrUserScopeRequired = errors.New("store repository requires authenticated user scope")
	ErrQueriesRequired   = errors.New("store repository requires database queries")
	// ErrTxStarterRequired is returned when the store was built over a plain DBTX (an existing
	// transaction) and so cannot begin the purge's own transaction.
	ErrTxStarterRequired = errors.New("store repository requires a transaction-capable pool")
)

type Store struct {
	queries *dbgen.Queries
	db      dbgen.DBTX
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	built := Store{queries: dbgen.New(db), db: db}
	if txer, ok := db.(txStarter); ok {
		built.txer = txer
	}
	return built
}

// DB exposes the query handle this store is bound to — the pool, or the open transaction inside
// InDecorateTx. It exists for the composition root's economy seam: the root binds the twinkle ledger
// store onto the very same transaction a save runs in, so the purchase and its debit commit or roll
// back together. Context behavior never calls it — the handle stays opaque behind store.EconomyTx.
func (s Store) DB() dbgen.DBTX {
	return s.db
}

// InDecorateTx runs one save inside one transaction, over a store bound to it ([P8]).
func (s Store) InDecorateTx(ctx context.Context, fn func(tx store.DecorateTx) error) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if err := fn(Store{queries: s.queries.WithTx(tx), db: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) ready(scope platform.UserScope) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	return nil
}

func (s Store) ListOrnamentOwnerships(
	ctx context.Context,
	scope platform.UserScope,
) ([]store.OrnamentOwnership, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListOrnamentOwnerships(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	ownerships := make([]store.OrnamentOwnership, 0, len(rows))
	for _, row := range rows {
		ownerships = append(ownerships, store.OrnamentOwnership{
			OrnamentID:  store.OrnamentID(row.OrnamentID),
			AcquiredVia: store.OrnamentAcquisition(row.AcquiredVia),
			AcquiredAt:  row.AcquiredAt.Time,
		})
	}
	return ownerships, nil
}

// InsertOrnamentOwnership reports whether THIS statement acquired the row: ON CONFLICT DO NOTHING
// skips a row the user already owns, so an affected count of 1 is the acquisition and 0 is the replay.
func (s Store) InsertOrnamentOwnership(
	ctx context.Context,
	scope platform.UserScope,
	ornamentID store.OrnamentID,
	acquiredVia store.OrnamentAcquisition,
) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	inserted, err := s.queries.InsertOrnamentOwnership(ctx, dbgen.InsertOrnamentOwnershipParams{
		UserID:      scope.UserID(),
		OrnamentID:  string(ornamentID),
		AcquiredVia: string(acquiredVia),
	})
	if err != nil {
		return false, err
	}
	return inserted > 0, nil
}

func (s Store) ListOrnamentSelections(
	ctx context.Context,
	scope platform.UserScope,
) ([]store.OrnamentSelection, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListOrnamentSelections(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	selections := make([]store.OrnamentSelection, 0, len(rows))
	for _, row := range rows {
		selections = append(selections, store.OrnamentSelection{
			Kind:       store.OrnamentKind(row.Kind),
			OrnamentID: store.OrnamentID(row.OrnamentID),
		})
	}
	return selections, nil
}

// UpsertOrnamentSelection applies one kind's ornament. It takes no transaction of its own: the
// Decorate use-case runs it over the transaction InDecorateTx opened, so the selection lands with the
// purchase it was paid for, or with neither.
func (s Store) UpsertOrnamentSelection(
	ctx context.Context,
	scope platform.UserScope,
	selection store.OrnamentSelection,
) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.UpsertOrnamentSelection(ctx, dbgen.UpsertOrnamentSelectionParams{
		UserID:     scope.UserID(),
		Kind:       string(selection.Kind),
		OrnamentID: string(selection.OrnamentID),
	})
}

// DeleteOrnamentSelection reverts one kind to its free default by removing the applied row.
func (s Store) DeleteOrnamentSelection(
	ctx context.Context,
	scope platform.UserScope,
	kind store.OrnamentKind,
) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.DeleteOrnamentSelection(ctx, dbgen.DeleteOrnamentSelectionParams{
		UserID: scope.UserID(),
		Kind:   string(kind),
	})
}

// PurgeUser hard-deletes the withdrawing user's own rows, both tables in one transaction so a
// retried sweep never finds a selection surviving its ownership history ([I1][U1]).
func (s Store) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	queries := s.queries.WithTx(tx)
	if err := queries.PurgeUserOrnamentSelections(ctx, scope.UserID()); err != nil {
		return err
	}
	if err := queries.PurgeUserOrnamentOwnerships(ctx, scope.UserID()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
