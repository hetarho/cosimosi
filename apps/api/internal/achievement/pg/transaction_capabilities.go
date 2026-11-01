package pg

import (
	"context"
	"errors"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

var ErrTransactionCapabilitiesRequired = errors.New("achievement transaction capabilities are not bound")

// WithSettlementBinding returns an immutable store configuration. The factory receives only the open transaction.
func (s Store) WithSettlementBinding(bind func(dbgen.DBTX) achievement.ClaimTx) Store {
	s.bindCapabilities = bind
	return s
}
func (s Store) boundTransaction(tx pgx.Tx) Store {
	bound := Store{queries: s.queries.WithTx(tx)}
	if s.bindCapabilities != nil {
		bound.capabilities = s.bindCapabilities(tx)
	}
	return bound
}
func (s Store) EnqueueSettlement(ctx context.Context, scope platform.UserScope, achievementID string) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.EnqueueSettlement(ctx, scope, achievementID)
}
