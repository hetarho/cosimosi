package main

import (
	"context"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
)

type workerStoreTransaction struct {
	tx      dbgen.DBTX
	binding *workerAchievementBinding
}

func (t workerStoreTransaction) SpendPurchase(context.Context, platform.UserScope, store.PurchaseSpend) error {
	return errWorkerRecorderTxUnusable
}
func (t workerStoreTransaction) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	if t.binding == nil || t.binding.service == nil {
		return errWorkerAchievementRecordingUnavailable
	}
	return t.binding.service.RecordProgress(ctx, scope, achievementpg.NewReadStore(t.tx), achievement.CounterKey(key), delta)
}
