package jobqueue

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

const testRetention = 30 * 24 * time.Hour

func cleanupPolicy() CleanupPolicy {
	return CleanupPolicy{Interval: time.Hour, BatchSize: 2, Retention: testRetention}
}

func TestCleanupRunsOnceWithinWindowForIdleAndBusyClaims(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name     string
		claimErr error
	}{
		{name: "idle", claimErr: ErrNoJob},
		{name: "busy"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			queue := &countingQueue{claimErr: tc.claimErr}
			cleaner := &fakeTerminalCleaner{}
			maintained := WithTerminalCleanup[testJob](queue, cleaner, cleanupPolicy())
			for _, claimAt := range []time.Time{now, now.Add(10 * time.Minute), now.Add(59 * time.Minute)} {
				if _, err := maintained.ClaimDue(context.Background(), claimAt); !errors.Is(err, tc.claimErr) {
					t.Fatalf("ClaimDue(%v) error = %v, want %v", claimAt, err, tc.claimErr)
				}
			}
			if cleaner.calls != 1 || !cleaner.cutoff.Equal(now.Add(-testRetention)) || cleaner.batchSize != 2 {
				t.Fatalf("cleanup = calls %d cutoff %v batch %d", cleaner.calls, cleaner.cutoff, cleaner.batchSize)
			}
			if queue.claims != 3 {
				t.Fatalf("underlying claims = %d, want 3", queue.claims)
			}
		})
	}
}

func TestCleanupDrainsOneFullBatchPerClaim(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &countingQueue{claimErr: ErrNoJob}
	cleaner := &fakeTerminalCleaner{results: []int{2, 2, 1}}
	maintained := WithTerminalCleanup[testJob](queue, cleaner, cleanupPolicy())
	for range 4 {
		if _, err := maintained.ClaimDue(context.Background(), now); !errors.Is(err, ErrNoJob) {
			t.Fatalf("ClaimDue error = %v, want ErrNoJob", err)
		}
	}
	if cleaner.calls != 3 || queue.claims != 4 {
		t.Fatalf("cleanup calls %d, claims %d; want three bounded batches over four claims", cleaner.calls, queue.claims)
	}
}

func TestCleanupFailureBacksOffAndClaimsProceed(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &countingQueue{}
	cleaner := &fakeTerminalCleaner{errs: []error{errors.New("cleanup unavailable")}}
	maintained := WithTerminalCleanup[testJob](queue, cleaner, cleanupPolicy())
	for _, claimAt := range []time.Time{now, now.Add(time.Minute)} {
		if _, err := maintained.ClaimDue(context.Background(), claimAt); err != nil {
			t.Fatalf("ClaimDue(%v) error = %v", claimAt, err)
		}
	}
	if cleaner.calls != 1 || queue.claims != 2 {
		t.Fatalf("calls after cleanup failure = cleaner %d queue %d, want 1/2", cleaner.calls, queue.claims)
	}
}

func TestCleanupRunsAgainAcrossClockWindows(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	cleaner := &fakeTerminalCleaner{}
	maintained := WithTerminalCleanup[testJob](&countingQueue{claimErr: ErrNoJob}, cleaner, cleanupPolicy())
	for _, claimAt := range []time.Time{now, now.Add(59 * time.Minute), now.Add(time.Hour), now.Add(119 * time.Minute), now.Add(2 * time.Hour)} {
		_, _ = maintained.ClaimDue(context.Background(), claimAt)
	}
	if cleaner.calls != 3 {
		t.Fatalf("cleanup calls = %d, want one at each of three windows", cleaner.calls)
	}
}

// Overlapping claims must still see exactly one batch per window rather than a half-advanced
// schedule; under -race this also proves the schedule's reads and writes are guarded.
func TestCleanupHandsOneWindowToOverlappingClaims(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	cleaner := &lockedTerminalCleaner{}
	maintained := WithTerminalCleanup[testJob](idleQueue{}, cleaner, cleanupPolicy())
	var claims sync.WaitGroup
	for range 16 {
		claims.Add(1)
		go func() {
			defer claims.Done()
			if _, err := maintained.ClaimDue(context.Background(), now); !errors.Is(err, ErrNoJob) {
				t.Errorf("ClaimDue error = %v, want ErrNoJob", err)
			}
		}()
	}
	claims.Wait()
	if got := cleaner.batches(); got != 1 {
		t.Fatalf("cleanup batches within one window = %d, want 1", got)
	}
	if _, err := maintained.ClaimDue(context.Background(), now.Add(time.Hour)); !errors.Is(err, ErrNoJob) {
		t.Fatalf("ClaimDue after the window error = %v, want ErrNoJob", err)
	}
	if got := cleaner.batches(); got != 2 {
		t.Fatalf("cleanup batches after the window elapsed = %d, want 2", got)
	}
}

// The wrapper adds cleanup only: every transition, the runner's safety stops included, reaches the
// wrapped queue unchanged.
func TestCleanupPassesEveryTransitionThrough(t *testing.T) {
	queue := &countingQueue{}
	maintained := WithTerminalCleanup[testJob](queue, &fakeTerminalCleaner{}, cleanupPolicy())
	job := testJob{id: "j1", kind: "retention_sweep", leaseGeneration: 99}
	_ = maintained.Fail(context.Background(), job, 3)
	_ = maintained.DeadLetter(context.Background(), job, DeadLetterClaimCeiling)
	_ = maintained.Retry(context.Background(), job, 1, time.Time{})
	_ = maintained.Complete(context.Background(), job)
	if queue.fails != 1 || queue.deadLetters != 1 || queue.retries != 1 || queue.completes != 1 {
		t.Fatalf("transitions = fail %d dead %d retry %d complete %d, want one each",
			queue.fails, queue.deadLetters, queue.retries, queue.completes)
	}
}

type countingQueue struct {
	claimErr    error
	claims      int
	completes   int
	retries     int
	fails       int
	deadLetters int
}

func (q *countingQueue) ClaimDue(context.Context, time.Time) (testJob, error) {
	q.claims++
	return testJob{}, q.claimErr
}
func (q *countingQueue) Complete(context.Context, testJob) error { q.completes++; return nil }
func (q *countingQueue) Retry(context.Context, testJob, int32, time.Time) error {
	q.retries++
	return nil
}
func (q *countingQueue) Fail(context.Context, testJob, int32) error { q.fails++; return nil }
func (q *countingQueue) DeadLetter(context.Context, testJob, DeadLetterCause) error {
	q.deadLetters++
	return nil
}

// idleQueue records nothing, so concurrent callers have no shared field to race on.
type idleQueue struct{}

func (idleQueue) ClaimDue(context.Context, time.Time) (testJob, error)       { return testJob{}, ErrNoJob }
func (idleQueue) Complete(context.Context, testJob) error                    { return nil }
func (idleQueue) Retry(context.Context, testJob, int32, time.Time) error     { return nil }
func (idleQueue) Fail(context.Context, testJob, int32) error                 { return nil }
func (idleQueue) DeadLetter(context.Context, testJob, DeadLetterCause) error { return nil }

type fakeTerminalCleaner struct {
	calls     int
	cutoff    time.Time
	batchSize int32
	results   []int
	errs      []error
}

func (f *fakeTerminalCleaner) PurgeTerminalJobs(_ context.Context, cutoff time.Time, batchSize int32) (int, error) {
	call := f.calls
	f.calls++
	f.cutoff, f.batchSize = cutoff, batchSize
	if call < len(f.errs) && f.errs[call] != nil {
		return 0, f.errs[call]
	}
	if call < len(f.results) {
		return f.results[call], nil
	}
	return 0, nil
}

type lockedTerminalCleaner struct {
	mu    sync.Mutex
	calls int
}

func (c *lockedTerminalCleaner) PurgeTerminalJobs(context.Context, time.Time, int32) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls++
	return 0, nil
}

func (c *lockedTerminalCleaner) batches() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}
