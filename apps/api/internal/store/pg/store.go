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
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	built := Store{queries: dbgen.New(db)}
	if txer, ok := db.(txStarter); ok {
		built.txer = txer
	}
	return built
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

func (s Store) InsertOrnamentOwnership(
	ctx context.Context,
	scope platform.UserScope,
	ornamentID store.OrnamentID,
	acquiredVia store.OrnamentAcquisition,
) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.InsertOrnamentOwnership(ctx, dbgen.InsertOrnamentOwnershipParams{
		UserID:      scope.UserID(),
		OrnamentID:  string(ornamentID),
		AcquiredVia: string(acquiredVia),
	})
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
// Decorate use-case builds a Store over its transaction handle so the selection lands with the
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
