package main

import (
	"context"
	"errors"
	"fmt"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	queuepg "github.com/cosimosi/api/internal/platform/jobqueue/pg"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	"github.com/cosimosi/api/internal/twinkle"
)

// These factories receive the transaction opened by the owning pg adapter. Domain ports expose
// behavior only; the shared database handle never crosses inward and no runtime assertion is needed.
func bindMemoryTransactions(repo memorypg.Store, economy *twinkle.Service, progress progressRecorder) memorypg.Store {
	return repo.WithEconomyBinding(func(tx dbgen.DBTX) memory.EconomyTx {
		return memoryTransaction{tx: tx, economy: economy, progress: progress}
	})
}

type memoryTransaction struct {
	tx       dbgen.DBTX
	economy  *twinkle.Service
	progress progressRecorder
}

func (t memoryTransaction) SpendMemory(ctx context.Context, scope platform.UserScope, spend memory.SpendIntent) error {
	if t.economy == nil {
		return errEconomyTxUnusable
	}
	return spendMemory(ctx, t.economy, scope, twinkleLedgerTx(t.tx), spend)
}
func (t memoryTransaction) EarnDiary(ctx context.Context, scope platform.UserScope, diaryID string) error {
	if t.economy == nil {
		return errEconomyTxUnusable
	}
	return t.economy.EarnOnWrite(ctx, scope, twinkleLedgerTx(t.tx), diaryID)
}
func (t memoryTransaction) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	return recordTransactionProgress(ctx, scope, t.progress, t.tx, key, delta)
}

func bindStoreTransactions(repo storepg.Store, economy *twinkle.Service, progress progressRecorder) storepg.Store {
	return repo.WithEconomyBinding(func(tx dbgen.DBTX) store.EconomyTx {
		return storeTransaction{tx: tx, economy: economy, progress: progress}
	})
}

type storeTransaction struct {
	tx       dbgen.DBTX
	economy  *twinkle.Service
	progress progressRecorder
}

func (t storeTransaction) SpendPurchase(ctx context.Context, scope platform.UserScope, spend store.PurchaseSpend) error {
	if t.economy == nil {
		return errDecorateTxUnusable
	}
	err := t.economy.CheckAndSpend(ctx, scope, twinkleLedgerTx(t.tx), twinkle.PurchaseSpendIntent(spend.Amount, spend.DedupKey))
	return storeSpendRefusal(err)
}
func (t storeTransaction) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	return recordTransactionProgress(ctx, scope, t.progress, t.tx, key, delta)
}

// recordTransactionProgress writes a counter report on the producer's own transaction, so it commits
// or rolls back with the launch, recall, view, release or save that caused it.
func recordTransactionProgress(ctx context.Context, scope platform.UserScope, progress progressRecorder, tx dbgen.DBTX, key string, delta int) error {
	if progress == nil {
		return errAchievementRecorderUnbound
	}
	return progress.RecordProgress(ctx, scope, achievementpg.NewReadStore(tx), achievement.CounterKey(key), delta)
}

func bindClaimTransactions(repo achievementpg.Store) achievementpg.Store {
	return repo.WithSettlementBinding(func(tx dbgen.DBTX) achievement.ClaimTx { return claimTransaction{tx: tx} })
}

type claimTransaction struct{ tx dbgen.DBTX }

func (t claimTransaction) EnqueueSettlement(ctx context.Context, scope platform.UserScope, achievementID string) error {
	jobs, err := achievement.NewSettlementJobScheduler(queuepg.NewStore(t.tx), nil, nil)
	if err != nil {
		return err
	}
	return jobs.Schedule(ctx, scope, achievementID)
}

func (t memoryTransaction) CheckMemorySpend(ctx context.Context, scope platform.UserScope, spend memory.SpendIntent) error {
	if t.economy == nil {
		return errEconomyTxUnusable
	}
	intent, err := twinkleIntent(spend)
	if err != nil {
		return err
	}
	err = t.economy.CheckCanSpend(ctx, scope, twinkleLedgerTx(t.tx), intent)
	if errors.Is(err, twinkle.ErrInsufficientTwinkle) {
		return fmt.Errorf("%w: %w", memory.ErrInsufficientTwinkle, err)
	}
	return err
}
