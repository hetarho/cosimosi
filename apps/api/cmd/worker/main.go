// Command worker drains the cosimosi background jobs table.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/cosimosi/api/internal/ai"

	// Blank imports register the available provider adapters into internal/ai's
	// factory. Provider + key are read from env per capability (COSIMOSI_LLM_* /
	// COSIMOSI_EMBEDDING_*); a missing key selects the keyless mock, an unknown
	// provider name is a startup error. Adding a provider = a new subpackage + one
	// blank import here, no consumer change.
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/deepseek"
	_ "github.com/cosimosi/api/internal/ai/voyage"

	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/secretbox"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
)

const workerPollInterval = time.Second

type withdrawalComposition struct {
	scheduler account.WithdrawalSweepScheduler
	purgers   []account.UserDataPurger
}

// newWithdrawalComposition assembles the sweep this process actually runs. Every context that owns
// per-user rows must be represented: this binary is the production sweep, so a missing leg leaves that
// context's rows behind a hard-deleted account ([I1][U1]). The store and achievement legs arrive as
// built purgers because each purges its own two tables in one transaction it owns.
func newWithdrawalComposition(
	pool *platformdb.Pool,
	jobStore memory.UserJobStore,
	memoryPurgeRepo memory.UserPurgeRepo,
	twinklePurgeRepo twinkle.UserPurgeRepo,
) (withdrawalComposition, error) {
	userJobs, err := memory.NewUserJobService(jobStore, nil, nil)
	if err != nil {
		return withdrawalComposition{}, err
	}
	return withdrawalComposition{
		scheduler: userJobs,
		purgers: []account.UserDataPurger{
			memory.NewWithdrawalPurger(memoryPurgeRepo),
			twinkle.NewWithdrawalPurger(twinklePurgeRepo),
			store.NewWithdrawalPurger(storepg.NewStore(pool.PgxPool())),
			achievement.NewWithdrawalPurger(achievementpg.NewStore(pool.PgxPool())),
		},
	}, nil
}

func main() {
	logger := log.Default()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, logger); err != nil && !errors.Is(err, context.Canceled) {
		logger.Fatalf("run worker: %v", err)
	}
}

func run(ctx context.Context, logger *log.Logger) error {
	cfg, err := platformdb.ConfigFromEnv()
	if err != nil {
		return err
	}
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	runner, mode, err := newWorkerRunner(pool, logger)
	if err != nil {
		return err
	}
	logger.Printf("memory worker starting ai_mode=%s", mode)
	return runner.Run(ctx)
}

func newWorkerRunner(pool *platformdb.Pool, logger *log.Logger) (interface{ Run(context.Context) error }, string, error) {
	memoryStore := memorypg.NewStore(pool.PgxPool())
	// Runtime AI config (the admin console): the worker resolves the same DB → env → keyless mock provider
	// config the API writes (both read ai_provider_config), so a SetAIConfig reaches the worker
	// without a redeploy. Its own meter counts its own process's calls.
	var decrypter ai.KeyDecrypter = secretbox.Disabled{}
	if box, ok, err := secretbox.NewFromEnv(); err != nil {
		return nil, "", err
	} else if ok {
		decrypter = box
	}
	adminStore := adminpg.NewStore(pool.PgxPool())
	adapters := ai.NewResolvingAdapters(ai.NewRuntimeConfigSource(adminStore, decrypter), ai.NewMeter(), logger)
	accountStore := accountpg.NewStore(pool.PgxPool())
	withdrawalAdapters, err := newWithdrawalComposition(
		pool,
		memoryStore,
		memoryStore,
		twinklepg.NewStore(pool.PgxPool()),
	)
	if err != nil {
		return nil, "", err
	}
	directory, err := newWorkerAccountDirectory()
	if err != nil {
		return nil, "", err
	}
	accountService, err := account.NewService(account.ServiceDeps{
		Store:              accountStore,
		Directory:          directory,
		InviteGranter:      workerNoInviteGranter{},
		SignupBonusGranter: workerNoSignupBonusGranter{},
		// This process settles no signup — it runs the job queue — so its recorder REFUSES rather than
		// counting nothing: an unexpected settlement here should be loud, not silently uncounted.
		Achievements: workerNoAchievementRecorder{},
		Withdrawals:  accountStore,
		Purgers:      withdrawalAdapters.purgers,
		Scheduler:    withdrawalAdapters.scheduler,
		Credentials:  directory,
	})
	if err != nil {
		return nil, "", err
	}
	runner, err := memory.NewDefaultJobRunner(
		memoryStore,
		adapters.Embedder,
		adapters.Semanticizer,
		workerPollInterval,
		logger,
		map[memory.JobKind]jobqueue.Handler[memory.Job]{
			memory.JobKindWithdrawal: memory.NewWithdrawalSweepJobHandler(accountService, nil),
		},
	)
	if err != nil {
		return nil, "", err
	}
	return runner, adapters.Mode, nil
}

type workerAccountDirectory interface {
	account.Directory
	account.CredentialDirectory
}

func newWorkerAccountDirectory() (workerAccountDirectory, error) {
	baseURL := os.Getenv("SUPABASE_PROJECT_URL")
	if baseURL == "" {
		baseURL = os.Getenv("SUPABASE_URL")
	}
	if directory, ok := platformsupabase.NewDirectory(
		baseURL,
		os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		&http.Client{Timeout: 5 * time.Second},
	); ok {
		return directory, nil
	}
	if strings.EqualFold(
		strings.TrimSpace(os.Getenv(apperr.EnvDeployEnvironment)),
		"production",
	) {
		return nil, errors.New(
			"production withdrawal worker requires Supabase Admin API credentials",
		)
	}
	return platformsupabase.Fake{}, nil
}

type workerNoInviteGranter struct{}

var (
	errWorkerInviteSettlementUnavailable = errors.New(
		"invite settlement is not available in the worker process",
	)
	errWorkerSignupBonusUnavailable = errors.New(
		"signup bonus settlement is not available in the worker process",
	)
	errWorkerAchievementRecordingUnavailable = errors.New(
		"achievement progress recording is not available in the worker process",
	)
)

func (workerNoInviteGranter) Grant(context.Context, platform.UserScope, string) error {
	return errWorkerInviteSettlementUnavailable
}

type workerNoSignupBonusGranter struct{}

func (workerNoSignupBonusGranter) Grant(context.Context, platform.UserScope) error {
	return errWorkerSignupBonusUnavailable
}

type workerNoAchievementRecorder struct{}

func (workerNoAchievementRecorder) RecordProgress(
	context.Context,
	platform.UserScope,
	any,
	string,
	int,
) error {
	return errWorkerAchievementRecordingUnavailable
}
