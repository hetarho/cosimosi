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
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/twinkle"
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
	// The settle drain RUNS here too. Without it the claim-settle kind is an unhandled kind, and an
	// unhandled kind of a never-dead-lettered leg would spin in the dev queue forever.
	settler, err := newDevWorkerAchievementSettler(pool, accountService)
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
			memory.JobKindWithdrawal:        memory.NewWithdrawalSweepJobHandler(accountService, nil),
			memory.JobKindAchievementSettle: memory.NewAchievementSettleJobHandler(settler),
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

// newDevWorkerAchievementSettler builds the drain leg for the in-process dev worker. It is a second
// composition rather than a share of the API's: this worker opens its own pool, and the settle path
// only needs the two payout legs — not the spend quoting or invite settlement the API's twinkle
// service also carries, both of which are fail-closed here.
func newDevWorkerAchievementSettler(
	pool *platformdb.Pool,
	accountService *account.Service,
) (*achievement.Service, error) {
	twinkleService, err := twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         twinklepg.NewStore(pool.PgxPool()),
		InviteResolver: twinkle.UnavailableInviteResolver{},
		Signals:        devWorkerNoSpendSignals{},
		UserZone:       accountTwinkleZone{service: accountService},
	})
	if err != nil {
		return nil, err
	}
	// store and achievement need each other here too: an ornament grant reports its ownership counter
	// through the achievement service, which pays through the store service. Same late binding the API
	// root uses, because the drain drives both halves.
	recorders := &achievementRecorderBinding{pool: pool}
	storeService, err := newStoreService(
		pool,
		twinkleService,
		storeAchievementRecorder{achievementRecorder{binding: recorders}},
	)
	if err != nil {
		return nil, err
	}
	settler, err := achievement.NewService(achievement.AchievementServiceDeps{
		Repo:      achievementpg.NewStore(pool.PgxPool()),
		Twinkle:   achievementTwinkleGranter{service: twinkleService},
		Ornaments: achievementOrnamentGranter{service: storeService},
		// This worker drains claims and never takes one, so the scheduler refuses rather than
		// stamping a claim whose drain nobody armed.
		Settlements: devWorkerNoSettlementScheduler{},
	})
	if err != nil {
		return nil, err
	}
	recorders.bind(settler)
	return settler, nil
}

var (
	errDevWorkerSpendQuotingUnavailable = errors.New(
		"twinkle spend quoting is not available in the dev worker",
	)
	errDevWorkerClaimSchedulingUnavailable = errors.New(
		"achievement claims are not taken in the dev worker",
	)
)

type devWorkerNoSpendSignals struct{}

func (devWorkerNoSpendSignals) RecallAccessibility(context.Context, platform.UserScope, string) (float64, error) {
	return 0, errDevWorkerSpendQuotingUnavailable
}

func (devWorkerNoSpendSignals) DiaryRecallAccessibilities(context.Context, platform.UserScope, string) ([]float64, error) {
	return nil, errDevWorkerSpendQuotingUnavailable
}

func (devWorkerNoSpendSignals) ViewableGistStage(context.Context, platform.UserScope, string) (int, error) {
	return 0, errDevWorkerSpendQuotingUnavailable
}

type devWorkerNoSettlementScheduler struct{}

func (devWorkerNoSettlementScheduler) ScheduleSettlement(
	context.Context,
	platform.UserScope,
	achievement.ClaimTx,
	string,
) error {
	return errDevWorkerClaimSchedulingUnavailable
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
