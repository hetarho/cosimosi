package pg

import (
	"context"
	"errors"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	queuepg "github.com/cosimosi/api/internal/platform/jobqueue/pg"
	"github.com/jackc/pgx/v5"
)

var ErrTransactionCapabilitiesRequired = errors.New("memory transaction capabilities are not bound")

// WithEconomyBinding returns an immutable store configuration. The factory receives only the open transaction.
func (s Store) WithEconomyBinding(bind func(dbgen.DBTX) memory.EconomyTx) Store {
	s.bindCapabilities = bind
	return s
}
func (s Store) boundTransaction(tx pgx.Tx) Store {
	bound := Store{queueStore: queuepg.NewStore(tx), queries: s.queries.WithTx(tx), db: tx}
	if s.bindCapabilities != nil {
		bound.capabilities = s.bindCapabilities(tx)
	}
	return bound
}
func (s Store) SpendMemory(ctx context.Context, scope platform.UserScope, spend memory.SpendIntent) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.SpendMemory(ctx, scope, spend)
}
func (s Store) EarnDiary(ctx context.Context, scope platform.UserScope, diaryID string) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.EarnDiary(ctx, scope, diaryID)
}
func (s Store) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.RecordProgress(ctx, scope, key, delta)
}

func (s Store) CheckMemorySpend(ctx context.Context, scope platform.UserScope, spend memory.SpendIntent) error {
	if s.capabilities == nil {
		return ErrTransactionCapabilitiesRequired
	}
	return s.capabilities.CheckMemorySpend(ctx, scope, spend)
}
