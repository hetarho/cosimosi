package memory

import (
	"context"
	"log"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

const terminalJobCleanupBatchSize int32 = 100

type WorkerConfig struct {
	MaxAttempts  int32
	MaxClaims    int32
	BackoffBase  time.Duration
	PollInterval time.Duration
	Now          func() time.Time
	Logger       *log.Logger
}

type TerminalJobCleaner interface {
	PurgeTerminalJobs(ctx context.Context, cutoff time.Time, batchSize int32) (int, error)
}

type WorkerStore interface {
	JobQueue
	JobSourceReader
	JobEmbeddingWriter
	JobSemanticStagesWriter
	TerminalJobCleaner
	ReleaseRepo
}

func DefaultWorkerConfig(pollInterval time.Duration, logger *log.Logger) WorkerConfig {
	return WorkerConfig{
		MaxAttempts:  int32(values.AiJobMaxAttempts),
		MaxClaims:    int32(values.AiJobMaxClaims),
		BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
		PollInterval: pollInterval,
		Logger:       logger,
	}
}

func NewDefaultJobRunner(
	store WorkerStore,
	embedder Embedder,
	semanticizer Semanticizer,
	pollInterval time.Duration,
	logger *log.Logger,
) (jobqueue.Runner[Job], error) {
	return NewJobRunner(
		store,
		store,
		store,
		store,
		NewRetentionSweeper(store),
		store,
		embedder,
		semanticizer,
		DefaultWorkerConfig(pollInterval, logger),
	)
}

func NewJobRunner(
	queue JobQueue,
	sources JobSourceReader,
	embeddingWriter JobEmbeddingWriter,
	semanticStagesWriter JobSemanticStagesWriter,
	sweeper DueReleaseSweeper,
	cleaner TerminalJobCleaner,
	embedder Embedder,
	semanticizer Semanticizer,
	cfg WorkerConfig,
) (jobqueue.Runner[Job], error) {
	now := cfg.Now
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	maintained := maintenanceQueue{
		JobQueue: queue,
		cleaner:  cleaner,
		now:      now,
		backoff:  cfg.BackoffBase,
		logger:   cfg.Logger,
	}
	handlers := map[string]jobqueue.Handler[Job]{
		string(JobKindEmbed):       NewEmbedJobHandler(embedder, sources, embeddingWriter),
		string(JobKindSemanticize): NewSemanticizeJobHandler(semanticizer, sources, semanticStagesWriter),
		string(JobKindConsolidate): NewConsolidateJobHandler(embedder, sources, embeddingWriter),
		string(JobKindRetention):   NewRetentionSweepJobHandler(sweeper, now),
	}
	return jobqueue.NewRunner[Job](maintained, handlers, jobqueue.Config{
		MaxAttempts:  cfg.MaxAttempts,
		MaxClaims:    cfg.MaxClaims,
		BackoffBase:  cfg.BackoffBase,
		PollInterval: cfg.PollInterval,
		Now:          now,
		Logger:       cfg.Logger,
	})
}

// maintenanceQueue puts bounded queue cleanup in the worker's existing polling
// loop. Cleanup is the one documented global maintenance scan and fails open so
// transient housekeeping errors never stop due product work. Retention failures
// remain retryable indefinitely: they are the only durable trigger an inactive
// user's explicit Release can rely on.
type maintenanceQueue struct {
	JobQueue
	cleaner TerminalJobCleaner
	now     func() time.Time
	backoff time.Duration
	logger  *log.Logger
}

func (q maintenanceQueue) ClaimDue(ctx context.Context, now time.Time) (Job, error) {
	if q.cleaner != nil {
		cutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
		if _, err := q.cleaner.PurgeTerminalJobs(ctx, cutoff, terminalJobCleanupBatchSize); err != nil && q.logger != nil {
			q.logger.Printf("terminal job cleanup failed: %v", err)
		}
	}
	return q.JobQueue.ClaimDue(ctx, now)
}

func (q maintenanceQueue) Fail(ctx context.Context, job Job, nextAttempts int32) error {
	if job.Kind != JobKindRetention {
		return q.JobQueue.Fail(ctx, job, nextAttempts)
	}
	delay := q.backoff
	if delay <= 0 {
		delay = time.Minute
	}
	return q.JobQueue.Retry(ctx, job, 0, q.now().Add(delay))
}
