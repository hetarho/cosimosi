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
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/secretbox"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
)

const workerPollInterval = time.Second

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
	store := memorypg.NewStore(pool.PgxPool())
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
	userJobs, err := memory.NewUserJobService(store, nil, nil)
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
		Withdrawals:        accountStore,
		Purgers: []account.UserDataPurger{
			workerMemoryPurger{store: store},
			workerTwinklePurger{store: twinklepg.NewStore(pool.PgxPool())},
		},
		Scheduler:   workerWithdrawalScheduler{jobs: userJobs},
		Credentials: directory,
	})
	if err != nil {
		return nil, "", err
	}
	runner, err := memory.NewDefaultJobRunner(
		store,
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

func (workerNoInviteGranter) Grant(context.Context, platform.UserScope, string) error { return nil }

type workerNoSignupBonusGranter struct{}

func (workerNoSignupBonusGranter) Grant(context.Context, platform.UserScope) error { return nil }

type workerWithdrawalScheduler struct {
	jobs memory.UserJobService
}

func (s workerWithdrawalScheduler) Schedule(
	ctx context.Context,
	scope platform.UserScope,
	dueAt time.Time,
) error {
	return s.jobs.ScheduleUserJob(ctx, scope, memory.UserJobSpec{
		Kind:     memory.JobKindWithdrawal,
		DedupKey: "withdrawal:" + scope.UserID(),
		DueAt:    dueAt,
	})
}

func (s workerWithdrawalScheduler) Cancel(ctx context.Context, scope platform.UserScope) error {
	return s.jobs.CancelUserJob(
		ctx,
		scope,
		memory.JobKindWithdrawal,
		"withdrawal:"+scope.UserID(),
	)
}

type workerMemoryPurger struct {
	store memory.UserPurgeRepo
}

func (workerMemoryPurger) PurgeName() string { return "memory" }

func (p workerMemoryPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	jobID, ok := memory.WithdrawalSweepJobID(ctx)
	if !ok {
		return errors.New("memory purge requires the in-flight withdrawal job id")
	}
	return memory.PurgeUser(ctx, p.store, scope, jobID)
}

type workerTwinklePurger struct {
	store twinkle.UserPurgeRepo
}

func (workerTwinklePurger) PurgeName() string { return "twinkle" }

func (p workerTwinklePurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	return twinkle.PurgeUser(ctx, p.store, scope)
}
