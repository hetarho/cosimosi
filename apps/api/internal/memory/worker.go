package memory

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

var ErrDuplicateJobHandler = errors.New("memory worker job handler kind is already registered")

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
	extraHandlers ...map[JobKind]jobqueue.Handler[Job],
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
		extraHandlers...,
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
	extraHandlers ...map[JobKind]jobqueue.Handler[Job],
) (jobqueue.Runner[Job], error) {
	now := cfg.Now
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	maintained := &maintenanceQueue{
		JobQueue:         queue,
		cleaner:          cleaner,
		now:              now,
		backoff:          cfg.BackoffBase,
		logger:           cfg.Logger,
		cleanupInterval:  time.Duration(values.WorkerCleanupIntervalS) * time.Second,
		cleanupBatchSize: int32(values.WorkerCleanupBatchSize),
	}
	handlers := map[string]jobqueue.Handler[Job]{
		string(JobKindEmbed):       NewEmbedJobHandler(embedder, sources, embeddingWriter),
		string(JobKindSemanticize): NewSemanticizeJobHandler(semanticizer, sources, semanticStagesWriter),
		string(JobKindConsolidate): NewConsolidateJobHandler(embedder, sources, embeddingWriter),
		string(JobKindRetention):   NewRetentionSweepJobHandler(sweeper, now),
	}
	for _, extra := range extraHandlers {
		for kind, handler := range extra {
			key := string(kind)
			if _, exists := handlers[key]; exists {
				return jobqueue.Runner[Job]{}, ErrDuplicateJobHandler
			}
			if key == "" || handler == nil {
				continue
			}
			handlers[key] = handler
		}
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
// transient housekeeping errors never stop due product work. The kinds
// retriedIndefinitely names never dead-letter here: each is the only durable
// trigger for something the user cannot ask for a second time.
type maintenanceQueue struct {
	JobQueue
	cleaner          TerminalJobCleaner
	now              func() time.Time
	backoff          time.Duration
	logger           *log.Logger
	cleanupInterval  time.Duration
	cleanupBatchSize int32
	nextCleanupAt    time.Time
}

func (q *maintenanceQueue) ClaimDue(ctx context.Context, now time.Time) (Job, error) {
	q.cleanupTerminalJobs(ctx, now)
	return q.JobQueue.ClaimDue(ctx, now)
}

func (q *maintenanceQueue) cleanupTerminalJobs(ctx context.Context, now time.Time) {
	if q.cleaner == nil || (!q.nextCleanupAt.IsZero() && now.Before(q.nextCleanupAt)) {
		return
	}
	// A partial batch or error advances the maintenance window. A full batch leaves the
	// schedule due, allowing exactly one more bounded batch on the next product claim.
	q.nextCleanupAt = now.Add(q.cleanupInterval)
	cutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
	purged, err := q.cleaner.PurgeTerminalJobs(ctx, cutoff, q.cleanupBatchSize)
	if err != nil {
		if q.logger != nil {
			q.logger.Printf("terminal job cleanup failed: %v", err)
		}
		return
	}
	if purged >= int(q.cleanupBatchSize) {
		q.nextCleanupAt = now
	}
}

func (q *maintenanceQueue) Fail(ctx context.Context, job Job, nextAttempts int32) error {
	if !retriedIndefinitely(job.Kind) {
		return q.JobQueue.Fail(ctx, job, nextAttempts)
	}
	delay := q.backoff
	if delay <= 0 {
		delay = time.Minute
	}
	return q.JobQueue.Retry(ctx, job, 0, q.now().Add(delay))
}
