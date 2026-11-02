package wiring

import (
	"log"
	"time"

	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/achievement"
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	queuepg "github.com/cosimosi/api/internal/platform/jobqueue/pg"
	"github.com/cosimosi/api/internal/platform/values"
)

// WorkerDeps are what a root hands the job worker: the worker's own pool, the account directory the
// withdrawal sweep deletes auth users through, and the decrypter for stored provider keys.
type WorkerDeps struct {
	Pool      *platformdb.Pool
	Directory DirectorySource
	Decrypter ai.KeyDecrypter
	Logger    *log.Logger
}

// Worker drains the job queue: memory's AI jobs and retention sweep, the withdrawal sweep and the
// achievement settle drain.
type Worker struct {
	Runner jobqueue.Runner[jobqueue.Record]
	AIMode string
}

// NewWorker composes the job worker. Every account seam is bound — the ones a job never reaches to a
// refusal — because account.NewService refuses a missing one, so a forgotten binding fails at boot.
func NewWorker(deps WorkerDeps) (Worker, error) {
	db := deps.Pool.PgxPool()
	adapters := AIAdapters(adminpg.NewStore(db), deps.Decrypter, ai.NewMeter(), deps.Logger)
	withdrawal, err := NewWithdrawal(db)
	if err != nil {
		return Worker{}, err
	}
	accountStore := accountpg.NewStore(db)
	accountService, err := account.NewService(account.ServiceDeps{
		Store:              accountStore,
		Directory:          deps.Directory,
		InviteSigner:       account.UnavailableInviteSigner{},
		InviteGranter:      noInviteGranter{},
		SignupBonusGranter: noSignupBonusGranter{},
		Achievements:       noAccountProgress{},
		Withdrawals:        accountStore,
		Purgers:            withdrawal.Purgers,
		Scheduler:          withdrawal.Scheduler,
		Credentials:        deps.Directory,
	})
	if err != nil {
		return Worker{}, err
	}
	settler, err := newAchievementSettler(db, TwinkleZone{Service: accountService})
	if err != nil {
		return Worker{}, err
	}
	memoryStore := memorypg.NewStore(db)
	registrations, err := jobRegistrations(memory.JobDeps{
		Embedder:             adapters.Embedder,
		Semanticizer:         adapters.Semanticizer,
		Sources:              memoryStore,
		EmbeddingWriter:      memoryStore,
		SemanticStagesWriter: memoryStore,
		Releases:             memoryStore,
	}, accountService, settler)
	if err != nil {
		return Worker{}, err
	}
	runner, err := newRunner(queuepg.NewStore(db), registrations, deps.Logger)
	if err != nil {
		return Worker{}, err
	}
	return Worker{Runner: runner, AIMode: adapters.Mode}, nil
}

// jobRegistrations composes every producer's job kinds. The withdrawal sweep and the settle drain are
// the only durable triggers for effects the user cannot request again, so they retry forever.
func jobRegistrations(
	memoryDeps memory.JobDeps,
	withdrawals account.DueWithdrawalSweeper,
	settler achievement.DueClaimSettler,
) (map[string]jobqueue.Registration[jobqueue.Record], error) {
	memoryJobs, err := memory.JobRegistrations(memoryDeps)
	if err != nil {
		return nil, err
	}
	return jobqueue.Registrations(memoryJobs, map[string]jobqueue.Registration[jobqueue.Record]{
		string(account.WithdrawalJobKind):     {Handler: account.NewWithdrawalSweepJobHandler(withdrawals, nil), RetryForever: true},
		string(achievement.SettlementJobKind): {Handler: achievement.NewSettlementJobHandler(settler), RetryForever: true},
	})
}

// newRunner runs the registrations over the queue with terminal-job cleanup in its polling loop.
func newRunner(
	queue queuepg.Store,
	registrations map[string]jobqueue.Registration[jobqueue.Record],
	logger *log.Logger,
) (jobqueue.Runner[jobqueue.Record], error) {
	cleaned := jobqueue.WithTerminalCleanup[jobqueue.Record](queue, queue, jobqueue.CleanupPolicy{
		Interval:  time.Duration(values.WorkerCleanupIntervalS) * time.Second,
		BatchSize: int32(values.WorkerCleanupBatchSize),
		Retention: time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour,
		Logger:    logger,
	})
	return jobqueue.NewRunner(cleaned, registrations, jobqueue.Config{
		MaxAttempts:  int32(values.AiJobMaxAttempts),
		MaxClaims:    int32(values.AiJobMaxClaims),
		BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
		PollInterval: jobqueue.DefaultPollInterval,
		Logger:       logger,
	})
}
