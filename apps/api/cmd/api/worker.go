package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/ai"

	// Blank imports register the available provider adapters into internal/ai's
	// factory (see cmd/worker for the per-capability env contract).
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/deepseek"
	_ "github.com/cosimosi/api/internal/ai/voyage"

	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
)

const (
	envDevWorker          = "COSIMOSI_DEV_WORKER"
	devWorkerPollInterval = time.Second
)

func maybeStartDevWorker(ctx context.Context, logger *log.Logger) (func(), error) {
	if !truthy(os.Getenv(envDevWorker)) {
		return func() {}, nil
	}
	cfg, err := platformdb.ConfigFromEnv()
	if err != nil {
		return nil, err
	}
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return nil, err
	}
	store := memorypg.NewStore(pool.PgxPool())
	accountStore := accountpg.NewStore(pool.PgxPool())
	// The sweep RUNS here, so every purge leg the API registers has to be registered here too — a
	// missing one leaves that context's rows behind a hard-deleted account.
	withdrawalAdapters, err := newWithdrawalComposition(
		store,
		store,
		twinklepg.NewStore(pool.PgxPool()),
		storeWithdrawalPurgerFor(pool),
		achievementWithdrawalPurgerFor(pool),
	)
	if err != nil {
		pool.Close()
		return nil, err
	}
	directory := accountDirectoryAdapter{source: newAccountDirectory()}
	accountService, err := account.NewService(account.ServiceDeps{
		Store:              accountStore,
		Directory:          directory,
		InviteGranter:      &accountInviteRewardGranter{},
		SignupBonusGranter: &accountSignupBonusGranter{},
		// The worker runs the withdrawal sweep and settles no signup, so its recorder REFUSES rather
		// than counting nothing: an unexpected settlement here should be loud, not silently uncounted.
		Achievements: accountAchievementUnavailable{},
		Withdrawals:  accountStore,
		Purgers:      withdrawalAdapters.purgers,
		Scheduler:    withdrawalAdapters.scheduler,
		Credentials:  directory,
	})
	if err != nil {
		pool.Close()
		return nil, err
	}
	adapters, err := ai.NewAdaptersFromEnv(ai.FactoryOptions{})
	if err != nil {
		pool.Close()
		return nil, err
	}
	runner, err := memory.NewDefaultJobRunner(
		store,
		adapters.Embedder,
		adapters.Semanticizer,
		devWorkerPollInterval,
		logger,
		map[memory.JobKind]jobqueue.Handler[memory.Job]{
			memory.JobKindWithdrawal: memory.NewWithdrawalSweepJobHandler(accountService, nil),
		},
	)
	if err != nil {
		pool.Close()
		return nil, err
	}

	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		logger.Printf("dev memory worker starting ai_mode=%s", adapters.Mode)
		if err := runner.Run(workerCtx); err != nil && !errors.Is(err, context.Canceled) {
			logger.Printf("dev memory worker stopped: %v", err)
		}
	}()
	return func() {
		cancel()
		<-done
		pool.Close()
	}, nil
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
