package pg

import (
	"context"
	"errors"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
	"github.com/jackc/pgx/v5"
)

var ErrTransactionCapabilitiesRequired = errors.New("store transaction capabilities are not bound")

// WithEconomyBinding returns an immutable store configuration. The factory receives only the open transaction.
func (s Store) WithEconomyBinding(bind func(dbgen.DBTX) store.EconomyTx) Store {
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
func (s Store) SpendPurchase(ctx context.Context, scope platform.UserScope, spend store.PurchaseSpend) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.SpendPurchase(ctx, scope, spend)
}
func (s Store) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.RecordProgress(ctx, scope, key, delta)
}
