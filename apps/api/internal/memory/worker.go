package memory

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

var (
	ErrDuplicateJobHandler = errors.New("memory worker job handler kind is already registered")
	ErrInvalidJobHandler   = errors.New("memory worker job handler needs a kind and a non-nil handler")
)

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
	// A malformed entry is refused, not skipped. Silently dropping one leaves a worker that starts
	// clean and then never processes that kind — and jobqueue.NewRunner filters nil handlers again
	// downstream, so a skip here would be invisible on both sides.
	for _, extra := range extraHandlers {
		for kind, handler := range extra {
			key := string(kind)
			if key == "" || handler == nil {
				return jobqueue.Runner[Job]{}, ErrInvalidJobHandler
			}
			if _, exists := handlers[key]; exists {
				return jobqueue.Runner[Job]{}, ErrDuplicateJobHandler
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
// transient housekeeping errors never stop due product work.
//
// The kinds retriedIndefinitely names do not give up on a spent retry budget: each is the only
// durable trigger for something the user cannot ask for a second time. That override covers Fail
// ALONE. DeadLetter is deliberately not overridden and not even declared here, so the embedded queue
// answers it: the runner's claim ceiling and its unhandled-kind stop are safety transitions, and a
// retry policy that swallowed them would turn a job that kills its worker into an endless loop at
// the head of the queue — with a log line claiming it had been contained.
type maintenanceQueue struct {
	JobQueue
	cleaner          TerminalJobCleaner
	now              func() time.Time
	backoff          time.Duration
	logger           *log.Logger
	cleanupInterval  time.Duration
	cleanupBatchSize int32

	// The cleanup schedule is this wrapper's own mutable state, and a claim is the only thing that
	// advances it. Runner claims are sequential today, so the lock is not what makes the cadence
	// correct — it is what keeps the cadence a property of this type instead of a property of its
	// single caller. Nothing in the wrapped JobQueue announces that claiming is non-reentrant, so a
	// second claimer would otherwise read and write a half-advanced window with no gate to fail.
	scheduleMu    sync.Mutex
	nextCleanupAt time.Time
}

func (q *maintenanceQueue) ClaimDue(ctx context.Context, now time.Time) (Job, error) {
	q.cleanupTerminalJobs(ctx, now)
	return q.JobQueue.ClaimDue(ctx, now)
}

func (q *maintenanceQueue) cleanupTerminalJobs(ctx context.Context, now time.Time) {
	// The window is claimed before the scan, not after it: the purge is I/O, and holding the
	// schedule across it would make a claim wait on housekeeping rather than skip it.
	if q.cleaner == nil || !q.claimCleanupWindow(now) {
		return
	}
	cutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
	purged, err := q.cleaner.PurgeTerminalJobs(ctx, cutoff, q.cleanupBatchSize)
	if err != nil {
		if q.logger != nil {
			q.logger.Printf("terminal job cleanup failed: %v", err)
		}
		return
	}
	// A full batch means rows are still waiting, so the schedule goes back to due and the next
	// product claim takes exactly one more bounded batch. A partial batch keeps the claimed window.
	if purged >= int(q.cleanupBatchSize) {
		q.reopenCleanupWindow(now)
	}
}

// claimCleanupWindow reports whether this call owns the next cleanup batch, advancing the schedule
// as it hands the window out so no second caller can take the same one.
func (q *maintenanceQueue) claimCleanupWindow(now time.Time) bool {
	q.scheduleMu.Lock()
	defer q.scheduleMu.Unlock()
	if !q.nextCleanupAt.IsZero() && now.Before(q.nextCleanupAt) {
		return false
	}
	q.nextCleanupAt = now.Add(q.cleanupInterval)
	return true
}

func (q *maintenanceQueue) reopenCleanupWindow(now time.Time) {
	q.scheduleMu.Lock()
	defer q.scheduleMu.Unlock()
	q.nextCleanupAt = now
}

// Fail is the POLICY give-up — the retry budget is spent. Only this one is overridden.
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
