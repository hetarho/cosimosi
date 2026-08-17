package memory

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestMaintenanceQueueRunsCleanupOnceWithinWindowForIdleAndBusyClaims(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name     string
		claimErr error
	}{
		{name: "idle", claimErr: jobqueue.ErrNoJob},
		{name: "busy"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			queue := &fakeWorkerQueue{claimErr: tc.claimErr}
			cleaner := &fakeTerminalJobCleaner{}
			maintained := maintenanceQueue{
				JobQueue:         queue,
				cleaner:          cleaner,
				cleanupInterval:  time.Hour,
				cleanupBatchSize: 2,
			}

			for _, claimAt := range []time.Time{now, now.Add(10 * time.Minute), now.Add(59 * time.Minute)} {
				_, err := maintained.ClaimDue(context.Background(), claimAt)
				if tc.claimErr == nil && err != nil {
					t.Fatalf("ClaimDue(%v) error = %v", claimAt, err)
				}
				if tc.claimErr != nil && !errors.Is(err, tc.claimErr) {
					t.Fatalf("ClaimDue(%v) error = %v, want %v", claimAt, err, tc.claimErr)
				}
			}

			wantCutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
			if cleaner.calls != 1 || !cleaner.cutoff.Equal(wantCutoff) || cleaner.batchSize != 2 {
				t.Fatalf("cleanup = calls %d cutoff %v batch %d", cleaner.calls, cleaner.cutoff, cleaner.batchSize)
			}
			if queue.claims != 3 {
				t.Fatalf("underlying claims = %d, want 3", queue.claims)
			}
		})
	}
}

func TestMaintenanceQueueDrainsOneFullBatchPerClaim(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &fakeWorkerQueue{claimErr: jobqueue.ErrNoJob}
	cleaner := &fakeTerminalJobCleaner{results: []int{2, 2, 1}}
	maintained := maintenanceQueue{
		JobQueue:         queue,
		cleaner:          cleaner,
		cleanupInterval:  time.Hour,
		cleanupBatchSize: 2,
	}

	for range 4 {
		if _, err := maintained.ClaimDue(context.Background(), now); !errors.Is(err, jobqueue.ErrNoJob) {
			t.Fatalf("ClaimDue error = %v, want ErrNoJob", err)
		}
	}
	if cleaner.calls != 3 {
		t.Fatalf("cleanup calls = %d, want three bounded batches", cleaner.calls)
	}
	if queue.claims != 4 {
		t.Fatalf("underlying claims = %d, want 4", queue.claims)
	}
}

func TestMaintenanceQueueCleanupFailureBacksOffAndClaimsProceed(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &fakeWorkerQueue{}
	cleaner := &fakeTerminalJobCleaner{errs: []error{errors.New("cleanup unavailable")}}
	maintained := maintenanceQueue{
		JobQueue:         queue,
		cleaner:          cleaner,
		cleanupInterval:  time.Hour,
		cleanupBatchSize: 2,
	}

	for _, claimAt := range []time.Time{now, now.Add(time.Minute)} {
		if _, err := maintained.ClaimDue(context.Background(), claimAt); err != nil {
			t.Fatalf("ClaimDue(%v) error = %v", claimAt, err)
		}
	}
	if cleaner.calls != 1 || queue.claims != 2 {
		t.Fatalf("calls after cleanup failure = cleaner %d queue %d, want 1/2", cleaner.calls, queue.claims)
	}
}

func TestMaintenanceQueueRunsAgainAcrossClockWindows(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &fakeWorkerQueue{claimErr: jobqueue.ErrNoJob}
	cleaner := &fakeTerminalJobCleaner{}
	maintained := maintenanceQueue{
		JobQueue:         queue,
		cleaner:          cleaner,
		cleanupInterval:  time.Hour,
		cleanupBatchSize: 2,
	}

	for _, claimAt := range []time.Time{
		now,
		now.Add(59 * time.Minute),
		now.Add(time.Hour),
		now.Add(119 * time.Minute),
		now.Add(2 * time.Hour),
	} {
		_, _ = maintained.ClaimDue(context.Background(), claimAt)
	}
	if cleaner.calls != 3 {
		t.Fatalf("cleanup calls = %d, want one at each of three windows", cleaner.calls)
	}
}

// The cadence has to be a property of the wrapper, not of the sequential runner loop that is its
// only caller today: a claim is what hands out a cleanup window, so overlapping claims must still
// see exactly one batch per window rather than a half-advanced schedule. Run under -race, this is
// also what proves the schedule's reads and writes are guarded.
func TestMaintenanceQueueHandsOneCleanupWindowToOverlappingClaims(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	cleaner := &concurrentTerminalJobCleaner{}
	maintained := &maintenanceQueue{
		JobQueue:         concurrentWorkerQueue{},
		cleaner:          cleaner,
		cleanupInterval:  time.Hour,
		cleanupBatchSize: 2,
	}

	var claims sync.WaitGroup
	for range 16 {
		claims.Add(1)
		go func() {
			defer claims.Done()
			if _, err := maintained.ClaimDue(context.Background(), now); !errors.Is(err, jobqueue.ErrNoJob) {
				t.Errorf("ClaimDue error = %v, want ErrNoJob", err)
			}
		}()
	}
	claims.Wait()

	if got := cleaner.batches(); got != 1 {
		t.Fatalf("cleanup batches within one window = %d, want 1", got)
	}
	if _, err := maintained.ClaimDue(context.Background(), now.Add(time.Hour)); !errors.Is(err, jobqueue.ErrNoJob) {
		t.Fatalf("ClaimDue after the window error = %v, want ErrNoJob", err)
	}
	if got := cleaner.batches(); got != 2 {
		t.Fatalf("cleanup batches after the window elapsed = %d, want 2", got)
	}
}

// A claim-only queue and cleaner that record nothing a concurrent caller could race on. The shared
// fakes above count unguarded fields on purpose — their tests are sequential.
type concurrentWorkerQueue struct{}

func (concurrentWorkerQueue) ClaimDue(context.Context, time.Time) (Job, error) {
	return Job{}, jobqueue.ErrNoJob
}
func (concurrentWorkerQueue) Complete(context.Context, Job) error                { return nil }
func (concurrentWorkerQueue) Retry(context.Context, Job, int32, time.Time) error { return nil }
func (concurrentWorkerQueue) Fail(context.Context, Job, int32) error             { return nil }

type concurrentTerminalJobCleaner struct {
	mu    sync.Mutex
	calls int
}

func (c *concurrentTerminalJobCleaner) PurgeTerminalJobs(context.Context, time.Time, int32) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls++
	return 0, nil
}

func (c *concurrentTerminalJobCleaner) batches() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}

func TestMaintenanceQueueKeepsRetentionFailuresDurablyRetryable(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &fakeWorkerQueue{}
	maintained := maintenanceQueue{
		JobQueue: queue,
		now:      func() time.Time { return now },
		backoff:  5 * time.Minute,
	}
	retention := revisionedJob(JobKindRetention, JobTarget{Kind: JobTargetRelease, ID: "release-1"})
	retention.LeaseGeneration = int64(values.AiJobMaxClaims) + 100

	if err := maintained.Fail(context.Background(), retention, int32(values.AiJobMaxAttempts)); err != nil {
		t.Fatalf("retention Fail failed: %v", err)
	}
	if queue.retries != 1 || queue.fails != 0 || queue.retryAttempts != 0 || !queue.retryAt.Equal(now.Add(5*time.Minute)) {
		t.Fatalf("retention transition = retries %d fails %d attempts %d at %v", queue.retries, queue.fails, queue.retryAttempts, queue.retryAt)
	}
	if got := retention.JobLeaseGeneration(); got != 0 {
		t.Fatalf("retention claim ceiling value = %d, want 0 for durable retry", got)
	}

	withdrawal := revisionedJob(JobKindWithdrawal, JobTarget{
		Kind: JobTargetUser,
		ID:   "user-1",
	})
	withdrawal.LeaseGeneration = int64(values.AiJobMaxClaims) + 100
	if err := maintained.Fail(context.Background(), withdrawal, int32(values.AiJobMaxAttempts)); err != nil {
		t.Fatalf("withdrawal Fail failed: %v", err)
	}
	if queue.retries != 2 || queue.fails != 0 || withdrawal.JobLeaseGeneration() != 0 {
		t.Fatalf(
			"withdrawal transition = retries %d fails %d lease ceiling %d, want durable retry",
			queue.retries,
			queue.fails,
			withdrawal.JobLeaseGeneration(),
		)
	}

	ordinary := revisionedJob(JobKindEmbed, JobTarget{Kind: JobTargetNeuron, ID: "n1", ExpectedRevision: 1})
	if err := maintained.Fail(context.Background(), ordinary, 5); err != nil {
		t.Fatalf("ordinary Fail failed: %v", err)
	}
	if queue.fails != 1 {
		t.Fatalf("ordinary fail calls = %d, want 1", queue.fails)
	}
}

type fakeWorkerQueue struct {
	claimJob      Job
	claimErr      error
	claims        int
	completes     int
	retries       int
	fails         int
	retryAttempts int32
	retryAt       time.Time
}

func (f *fakeWorkerQueue) ClaimDue(context.Context, time.Time) (Job, error) {
	f.claims++
	return f.claimJob, f.claimErr
}

func (f *fakeWorkerQueue) Complete(context.Context, Job) error {
	f.completes++
	return nil
}

func (f *fakeWorkerQueue) Retry(_ context.Context, _ Job, attempts int32, nextRunAt time.Time) error {
	f.retries++
	f.retryAttempts = attempts
	f.retryAt = nextRunAt
	return nil
}

func (f *fakeWorkerQueue) Fail(context.Context, Job, int32) error {
	f.fails++
	return nil
}

type fakeTerminalJobCleaner struct {
	cutoff    time.Time
	batchSize int32
	calls     int
	results   []int
	errs      []error
	err       error
}

func (f *fakeTerminalJobCleaner) PurgeTerminalJobs(_ context.Context, cutoff time.Time, batchSize int32) (int, error) {
	index := f.calls
	f.calls++
	f.cutoff = cutoff
	f.batchSize = batchSize
	if index < len(f.errs) && f.errs[index] != nil {
		return 0, f.errs[index]
	}
	if index < len(f.results) {
		return f.results[index], nil
	}
	return 0, f.err
}
