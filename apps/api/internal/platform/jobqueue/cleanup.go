package jobqueue

import (
	"context"
	"log"
	"sync"
	"time"
)

// TerminalCleaner purges finished jobs older than a cutoff, at most batchSize per call.
type TerminalCleaner interface {
	PurgeTerminalJobs(ctx context.Context, cutoff time.Time, batchSize int32) (int, error)
}

// CleanupPolicy is the root's terminal-job housekeeping budget.
type CleanupPolicy struct {
	// Interval is the shortest gap between two cleanup batches.
	Interval time.Duration
	// BatchSize bounds one purge.
	BatchSize int32
	// Retention is how long a finished job stays before it may be purged.
	Retention time.Duration
	Logger    *log.Logger
}

// WithTerminalCleanup puts bounded terminal-job cleanup into the worker's existing polling loop:
// a claim runs at most one purge batch per interval before claiming. Cleanup is the one documented
// global maintenance scan and fails open, so transient housekeeping errors never stop due work.
func WithTerminalCleanup[J Job](queue Queue[J], cleaner TerminalCleaner, policy CleanupPolicy) Queue[J] {
	return &cleanupQueue[J]{Queue: queue, cleaner: cleaner, policy: policy}
}

type cleanupQueue[J Job] struct {
	Queue[J]
	cleaner TerminalCleaner
	policy  CleanupPolicy

	// The cleanup schedule is this wrapper's own mutable state, and a claim is the only thing that
	// advances it. The lock keeps the cadence a property of this type rather than of a single
	// caller: concurrent claimers would otherwise read and write a half-advanced window.
	scheduleMu    sync.Mutex
	nextCleanupAt time.Time
}

func (q *cleanupQueue[J]) ClaimDue(ctx context.Context, now time.Time, lease time.Duration) (J, error) {
	q.cleanupTerminalJobs(ctx, now)
	return q.Queue.ClaimDue(ctx, now, lease)
}

func (q *cleanupQueue[J]) cleanupTerminalJobs(ctx context.Context, now time.Time) {
	// The window is claimed before the scan, not after it: the purge is I/O, and holding the
	// schedule across it would make a claim wait on housekeeping rather than skip it.
	if q.cleaner == nil || !q.claimCleanupWindow(now) {
		return
	}
	purged, err := q.cleaner.PurgeTerminalJobs(ctx, now.Add(-q.policy.Retention), q.policy.BatchSize)
	if err != nil {
		if q.policy.Logger != nil {
			q.policy.Logger.Printf("terminal job cleanup failed: %v", err)
		}
		return
	}
	// A full batch means rows are still waiting, so the schedule goes back to due and the next
	// claim takes exactly one more bounded batch. A partial batch keeps the claimed window.
	if purged >= int(q.policy.BatchSize) {
		q.reopenCleanupWindow(now)
	}
}

// claimCleanupWindow reports whether this call owns the next cleanup batch, advancing the schedule
// as it hands the window out so no second caller can take the same one.
func (q *cleanupQueue[J]) claimCleanupWindow(now time.Time) bool {
	q.scheduleMu.Lock()
	defer q.scheduleMu.Unlock()
	if !q.nextCleanupAt.IsZero() && now.Before(q.nextCleanupAt) {
		return false
	}
	q.nextCleanupAt = now.Add(q.policy.Interval)
	return true
}

func (q *cleanupQueue[J]) reopenCleanupWindow(now time.Time) {
	q.scheduleMu.Lock()
	defer q.scheduleMu.Unlock()
	q.nextCleanupAt = now
}
