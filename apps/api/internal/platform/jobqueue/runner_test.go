package jobqueue

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

func TestRunnerCompletesHandledJobWithUserContext(t *testing.T) {
	now := fixedRunnerNow()
	queue := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed"}}
	var handlerUserID string
	runner := mustRunner(t, queue, map[string]Handler[testJob]{
		"embed": func(ctx context.Context, _ testJob) error {
			handlerUserID, _ = platform.UserIDFromContext(ctx)
			return nil
		},
	}, now)

	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if !worked || queue.completed.id != "job-1" || handlerUserID != "user-1" {
		t.Fatalf("worked=%v completed=%+v handlerUserID=%q", worked, queue.completed, handlerUserID)
	}
}

func TestRunnerRetriesWithExponentialBackoff(t *testing.T) {
	now := fixedRunnerNow()
	queue := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed"}}
	runner := mustRunner(t, queue, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { return errors.New("temporary") },
	}, now)

	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if !worked || queue.retried.id != "job-1" || queue.retryAttempts != 1 || !queue.retryAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("retry state worked=%v job=%+v attempts=%d at=%s", worked, queue.retried, queue.retryAttempts, queue.retryAt)
	}
}

func TestRunnerSchedulesRetryWithoutIncrementingAttempts(t *testing.T) {
	now := fixedRunnerNow()
	retryAt := now.Add(12 * time.Hour)
	queue := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed", attempts: 2}}
	runner := mustRunner(t, queue, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { return delayedError{at: retryAt} },
	}, now)

	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if !worked || queue.retried.id != "job-1" || queue.retryAttempts != 2 || !queue.retryAt.Equal(retryAt) {
		t.Fatalf("retry state worked=%v job=%+v attempts=%d at=%s", worked, queue.retried, queue.retryAttempts, queue.retryAt)
	}
}

func TestRunnerFailsExhaustedAndUnhandledJobs(t *testing.T) {
	now := fixedRunnerNow()
	exhausted := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed", attempts: 2}}
	runner := mustRunner(t, exhausted, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { return errors.New("still failing") },
	}, now)
	if _, err := runner.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce exhausted failed: %v", err)
	}
	if exhausted.failed.id != "job-1" || exhausted.failAttempts != 3 {
		t.Fatalf("exhausted fail state = %+v attempts=%d", exhausted.failed, exhausted.failAttempts)
	}

	unhandled := &fakeQueue{claim: testJob{id: "job-2", userID: "user-1", kind: "extract"}}
	runner = mustRunner(t, unhandled, map[string]Handler[testJob]{}, now)
	if _, err := runner.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce unhandled failed: %v", err)
	}
	if unhandled.failed.id != "job-2" || unhandled.failAttempts != 1 {
		t.Fatalf("unhandled fail state = %+v attempts=%d", unhandled.failed, unhandled.failAttempts)
	}
}

func TestRunnerRecoversHandlerPanicIntoRetry(t *testing.T) {
	now := fixedRunnerNow()
	queue := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed"}}
	runner := mustRunner(t, queue, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { panic("boom") },
	}, now)

	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce returned error for a panicking handler (worker would have crashed): %v", err)
	}
	if !worked || queue.retried.id != "job-1" || queue.retryAttempts != 1 {
		t.Fatalf("panic did not flow through the retry path: worked=%v retried=%+v attempts=%d", worked, queue.retried, queue.retryAttempts)
	}
}

func TestRunnerDeadLettersJobReclaimedPastMaxClaims(t *testing.T) {
	now := fixedRunnerNow()
	// leaseGeneration 11 > MaxClaims 10: the job has been re-claimed past the ceiling
	// without ever completing (a handler that keeps killing its worker).
	queue := &fakeQueue{claim: testJob{id: "job-1", userID: "user-1", kind: "embed", attempts: 1, leaseGeneration: 11}}
	handlerRan := false
	runner := mustRunner(t, queue, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { handlerRan = true; return nil },
	}, now)

	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if !worked || queue.failed.id != "job-1" {
		t.Fatalf("over-claimed job not dead-lettered: worked=%v failed=%+v", worked, queue.failed)
	}
	if handlerRan {
		t.Fatal("handler ran for a dead-lettered job; it must be failed without executing")
	}
}

func TestRunnerReturnsIdleWhenNoJobIsDue(t *testing.T) {
	runner := mustRunner(t, &fakeQueue{claimErr: ErrNoJob}, nil, fixedRunnerNow())
	worked, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce failed: %v", err)
	}
	if worked {
		t.Fatal("RunOnce worked with no due job")
	}
}

func TestRunnerKeepsPollingAfterQueueTransitionErrors(t *testing.T) {
	now := fixedRunnerNow()
	dbErr := errors.New("temporary db")

	runner := mustRunner(t, &fakeQueue{claimErr: dbErr}, nil, now)
	worked, err := runner.RunOnce(context.Background())
	if err != nil || worked {
		t.Fatalf("claim error worked=%v err=%v, want idle nil", worked, err)
	}

	complete := &fakeQueue{
		claim:       testJob{id: "job-1", userID: "user-1", kind: "embed"},
		completeErr: dbErr,
	}
	runner = mustRunner(t, complete, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { return nil },
	}, now)
	worked, err = runner.RunOnce(context.Background())
	if err != nil || !worked {
		t.Fatalf("complete error worked=%v err=%v, want worked nil", worked, err)
	}

	retry := &fakeQueue{
		claim:    testJob{id: "job-2", userID: "user-1", kind: "embed"},
		retryErr: dbErr,
	}
	runner = mustRunner(t, retry, map[string]Handler[testJob]{
		"embed": func(context.Context, testJob) error { return errors.New("handler failed") },
	}, now)
	worked, err = runner.RunOnce(context.Background())
	if err != nil || !worked {
		t.Fatalf("retry error worked=%v err=%v, want worked nil", worked, err)
	}
}

func TestRunnerStopsOnContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	runner := mustRunner(t, &fakeQueue{claimErr: context.Canceled}, nil, fixedRunnerNow())
	if _, err := runner.RunOnce(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("RunOnce error = %v, want context.Canceled", err)
	}
}

func mustRunner(t *testing.T, queue *fakeQueue, handlers map[string]Handler[testJob], now time.Time) Runner[testJob] {
	t.Helper()
	runner, err := NewRunner[testJob](queue, handlers, Config{
		MaxAttempts:  3,
		MaxClaims:    10,
		BackoffBase:  time.Minute,
		PollInterval: time.Millisecond,
		Now:          func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewRunner failed: %v", err)
	}
	return runner
}

type testJob struct {
	id              string
	userID          string
	kind            string
	attempts        int32
	leaseGeneration int64
}

func (j testJob) JobID() string             { return j.id }
func (j testJob) JobUserID() string         { return j.userID }
func (j testJob) JobKind() string           { return j.kind }
func (j testJob) JobAttempts() int32        { return j.attempts }
func (j testJob) JobLeaseGeneration() int64 { return j.leaseGeneration }

type delayedError struct {
	at time.Time
}

func (e delayedError) Error() string {
	return "delayed"
}

func (e delayedError) RetryAt() time.Time {
	return e.at
}

type fakeQueue struct {
	claim    testJob
	claimErr error

	completed testJob
	retried   testJob
	failed    testJob

	retryAttempts int32
	failAttempts  int32
	retryAt       time.Time

	completeErr error
	retryErr    error
	failErr     error
}

func (q *fakeQueue) ClaimDue(context.Context, time.Time) (testJob, error) {
	if q.claimErr != nil {
		return testJob{}, q.claimErr
	}
	return q.claim, nil
}

func (q *fakeQueue) Complete(_ context.Context, job testJob) error {
	if q.completeErr != nil {
		return q.completeErr
	}
	q.completed = job
	return nil
}

func (q *fakeQueue) Retry(_ context.Context, job testJob, nextAttempts int32, nextRunAt time.Time) error {
	if q.retryErr != nil {
		return q.retryErr
	}
	q.retried = job
	q.retryAttempts = nextAttempts
	q.retryAt = nextRunAt
	return nil
}

func (q *fakeQueue) Fail(_ context.Context, job testJob, nextAttempts int32) error {
	if q.failErr != nil {
		return q.failErr
	}
	q.failed = job
	q.failAttempts = nextAttempts
	return nil
}

func fixedRunnerNow() time.Time {
	return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
}
