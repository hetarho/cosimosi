package pg

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

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
	if err := queries.PurgeUserTwinkleLedger(ctx, scope.UserID()); err != nil {
		return err
	}
	if err := queries.PurgeUserTwinkleBalance(ctx, scope.UserID()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
