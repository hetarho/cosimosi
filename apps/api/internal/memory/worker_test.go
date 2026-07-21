package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestMaintenanceQueueRunsBoundedTerminalCleanupBeforeClaim(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	queue := &fakeWorkerQueue{claimErr: jobqueue.ErrNoJob}
	cleaner := &fakeTerminalJobCleaner{}
	maintained := maintenanceQueue{
		JobQueue: queue,
		cleaner:  cleaner,
		now:      func() time.Time { return now },
		backoff:  time.Minute,
	}

	if _, err := maintained.ClaimDue(context.Background(), now); !errors.Is(err, jobqueue.ErrNoJob) {
		t.Fatalf("ClaimDue error = %v, want ErrNoJob", err)
	}
	wantCutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
	if cleaner.calls != 1 || !cleaner.cutoff.Equal(wantCutoff) || cleaner.batchSize != terminalJobCleanupBatchSize {
		t.Fatalf("cleanup = calls %d cutoff %v batch %d", cleaner.calls, cleaner.cutoff, cleaner.batchSize)
	}
	if queue.claims != 1 {
		t.Fatalf("underlying claims = %d, want 1", queue.claims)
	}
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
	err       error
}

func (f *fakeTerminalJobCleaner) PurgeTerminalJobs(_ context.Context, cutoff time.Time, batchSize int32) (int, error) {
	f.calls++
	f.cutoff = cutoff
	f.batchSize = batchSize
	return 0, f.err
}
