package jobqueue

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
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

// The two stops are different transitions, and the split is what lets a queue override the retry
// policy without also disabling the runner's safety stops.
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

	// No handler is a misconfiguration, not a spent budget: retrying cannot grow one, so it takes the
	// safety transition and never reaches a retry policy that might keep it alive.
	unhandled := &fakeQueue{claim: testJob{id: "job-2", userID: "user-1", kind: "extract"}}
	runner = mustRunner(t, unhandled, map[string]Handler[testJob]{}, now)
	if _, err := runner.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce unhandled failed: %v", err)
	}
	if unhandled.deadLettered.id != "job-2" || unhandled.deadCause != DeadLetterUnhandledKind {
		t.Fatalf("unhandled dead-letter state = %+v cause=%q", unhandled.deadLettered, unhandled.deadCause)
	}
	if unhandled.failed.id != "" {
		t.Fatalf("unhandled kind took the policy Fail path: %+v", unhandled.failed)
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
	if !worked || queue.deadLettered.id != "job-1" || queue.deadCause != DeadLetterClaimCeiling {
		t.Fatalf("over-claimed job not dead-lettered: worked=%v dead=%+v cause=%q", worked, queue.deadLettered, queue.deadCause)
	}
	// It must NOT arrive as a policy give-up: that is the path a retry-forever queue overrides, and
	// routing the ceiling through it is what turns a worker-killing job into an endless loop.
	if queue.failed.id != "" {
		t.Fatalf("claim ceiling took the policy Fail path: %+v", queue.failed)
	}
	if handlerRan {
		t.Fatal("handler ran for a dead-lettered job; it must be stopped without executing")
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

func TestRegistryOwnsDurableClaimPolicyAndStillRejectsUnhandledKinds(t *testing.T) {
	for _, handled := range []bool{true, false} {
		queue := &fakeQueue{claim: testJob{id: "durable", userID: "owner", kind: "external", leaseGeneration: 99}}
		registrations := map[string]Registration[testJob]{}
		if handled {
			registrations["external"] = Registration[testJob]{
				Handler: func(context.Context, testJob) error { return nil }, RetryForever: true,
			}
		}
		runner, err := NewRunner[testJob](queue, registrations, Config{Lease: time.Minute, MaxAttempts: 3, MaxClaims: 10, BackoffBase: time.Second})
		if err != nil {
			t.Fatal(err)
		}
		// The runner copies its registrations, so a later edit of the caller's map changes nothing.
		delete(registrations, "external")
		if _, err := runner.RunOnce(context.Background()); err != nil {
			t.Fatal(err)
		}
		if handled && queue.completed.id != "durable" {
			t.Fatal("durable registration lost its retry policy")
		}
		// A kind nobody registers carries no retry policy, so the claim ceiling stops it first.
		if !handled && queue.deadCause != DeadLetterClaimCeiling {
			t.Fatalf("unregistered kind past the ceiling: %q", queue.deadCause)
		}
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
	registrations := map[string]Registration[testJob]{}
	for kind, handler := range handlers {
		registrations[kind] = Registration[testJob]{Handler: handler}
	}
	runner, err := NewRunner[testJob](queue, registrations, Config{
		Lease:        time.Minute,
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

	completed    testJob
	retried      testJob
	failed       testJob
	deadLettered testJob
	deadCause    DeadLetterCause

	retryAttempts int32
	failAttempts  int32
	retryAt       time.Time

	completeErr   error
	retryErr      error
	failErr       error
	deadLetterErr error
}

func (q *fakeQueue) ClaimDue(context.Context, time.Time, time.Duration) (testJob, error) {
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

// Tracked apart from Fail so a test can prove the runner used the SAFETY transition — a queue that
// overrides the retry policy must not be able to swallow it.
func (q *fakeQueue) DeadLetter(_ context.Context, job testJob, cause DeadLetterCause) error {
	if q.deadLetterErr != nil {
		return q.deadLetterErr
	}
	q.deadLettered = job
	q.deadCause = cause
	return nil
}

func fixedRunnerNow() time.Time {
	return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
}

// A durable kind's spent retry budget re-queues it at the base backoff with a fresh attempt count;
// an ordinary kind fails. Both halves hold at once.
func TestRetryForeverRequeuesASpentBudgetAndOrdinaryKindsFail(t *testing.T) {
	now := fixedRunnerNow()
	failing := func(context.Context, testJob) error { return errors.New("handler failed") }
	for _, tc := range []struct {
		forever bool
	}{{forever: true}, {forever: false}} {
		queue := &fakeQueue{claim: testJob{id: "spent", userID: "owner", kind: "durable", attempts: 2}}
		runner, err := NewRunner[testJob](queue, map[string]Registration[testJob]{
			"durable": {Handler: failing, RetryForever: tc.forever},
		}, Config{Lease: time.Minute, MaxAttempts: 3, MaxClaims: 10, BackoffBase: time.Minute, Now: func() time.Time { return now }})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := runner.RunOnce(context.Background()); err != nil {
			t.Fatal(err)
		}
		if tc.forever {
			if queue.retried.id != "spent" || queue.retryAttempts != 0 || !queue.retryAt.Equal(now.Add(time.Minute)) || queue.failed.id != "" {
				t.Fatalf("durable spent budget: retried %q attempts %d at %v, failed %q", queue.retried.id, queue.retryAttempts, queue.retryAt, queue.failed.id)
			}
			continue
		}
		if queue.failed.id != "spent" || queue.retried.id != "" {
			t.Fatalf("ordinary spent budget: failed %q retried %q", queue.failed.id, queue.retried.id)
		}
	}
}

func TestRegistrationsRefuseMalformedAndDuplicateKinds(t *testing.T) {
	handler := func(context.Context, testJob) error { return nil }
	if _, err := Registrations(map[string]Registration[testJob]{"": {Handler: handler}}); !errors.Is(err, ErrInvalidRegistration) {
		t.Fatalf("blank kind err = %v, want ErrInvalidRegistration", err)
	}
	if _, err := Registrations(map[string]Registration[testJob]{"embed": {}}); !errors.Is(err, ErrInvalidRegistration) {
		t.Fatalf("nil handler err = %v, want ErrInvalidRegistration", err)
	}
	if _, err := Registrations(
		map[string]Registration[testJob]{"embed": {Handler: handler}},
		map[string]Registration[testJob]{"embed": {Handler: handler}},
	); !errors.Is(err, ErrDuplicateRegistration) {
		t.Fatalf("duplicate kind err = %v, want ErrDuplicateRegistration", err)
	}
}

// drainQueue hands out a fixed list of jobs once each and records the transitions, guarded for lanes.
type drainQueue struct {
	mu        sync.Mutex
	pending   []testJob
	completed []string
	retried   map[string]time.Time
	attempts  map[string]int32
	retryCtx  []error
}

func (q *drainQueue) ClaimDue(ctx context.Context, _ time.Time, _ time.Duration) (testJob, error) {
	if err := ctx.Err(); err != nil {
		return testJob{}, err
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.pending) == 0 {
		return testJob{}, ErrNoJob
	}
	job := q.pending[0]
	q.pending = q.pending[1:]
	return job, nil
}

func (q *drainQueue) Complete(ctx context.Context, job testJob) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	q.completed = append(q.completed, job.id)
	return nil
}

func (q *drainQueue) Retry(ctx context.Context, job testJob, nextAttempts int32, nextRunAt time.Time) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.retryCtx = append(q.retryCtx, ctx.Err())
	if q.retried == nil {
		q.retried, q.attempts = map[string]time.Time{}, map[string]int32{}
	}
	q.retried[job.id], q.attempts[job.id] = nextRunAt, nextAttempts
	return nil
}

func (q *drainQueue) Fail(context.Context, testJob, int32) error { return nil }

func (q *drainQueue) DeadLetter(context.Context, testJob, DeadLetterCause) error { return nil }

func drainRunner(t *testing.T, queue *drainQueue, handler Handler[testJob], lanes int, drain time.Duration, now time.Time) Runner[testJob] {
	t.Helper()
	runner, err := NewRunner[testJob](queue, map[string]Registration[testJob]{"kind": {Handler: handler}}, Config{
		Lease: time.Minute, MaxAttempts: 3, BackoffBase: time.Minute, PollInterval: time.Millisecond,
		Lanes: lanes, DrainTimeout: drain, Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewRunner failed: %v", err)
	}
	return runner
}

// Two lanes run two slow handlers at once, so the queue clears in about half the single-lane time.
func TestLanesRunHandlersConcurrently(t *testing.T) {
	jobs := func() []testJob {
		out := make([]testJob, 0, 8)
		for i := range 8 {
			out = append(out, testJob{id: fmt.Sprintf("job-%d", i), userID: "user-1", kind: "kind"})
		}
		return out
	}
	elapsed := func(lanes int) (time.Duration, []string) {
		queue := &drainQueue{pending: jobs()}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		handler := func(context.Context, testJob) error { time.Sleep(20 * time.Millisecond); return nil }
		runner := drainRunner(t, queue, handler, lanes, time.Second, fixedRunnerNow())
		start := time.Now()
		done := make(chan error, 1)
		go func() { done <- runner.Run(ctx) }()
		for {
			queue.mu.Lock()
			finished := len(queue.completed)
			queue.mu.Unlock()
			if finished == 8 {
				break
			}
			time.Sleep(time.Millisecond)
		}
		took := time.Since(start)
		cancel()
		<-done
		return took, queue.completed
	}
	single, _ := elapsed(1)
	double, completed := elapsed(2)
	if double > single*3/4 {
		t.Fatalf("two lanes took %v against one lane's %v, want about half", double, single)
	}
	slices.Sort(completed)
	if len(slices.Compact(completed)) != 8 {
		t.Fatalf("completed = %v, want every job exactly once", completed)
	}
}

// A shutdown stops claiming but lets the in-flight handler finish within the drain, so the job
// completes instead of waiting out its lease.
func TestShutdownDrainsTheInFlightHandler(t *testing.T) {
	queue := &drainQueue{pending: []testJob{{id: "job-1", userID: "user-1", kind: "kind"}, {id: "job-2", userID: "user-1", kind: "kind"}}}
	entered := make(chan struct{})
	handler := func(ctx context.Context, job testJob) error {
		if job.id == "job-1" {
			close(entered)
			time.Sleep(50 * time.Millisecond)
		}
		return ctx.Err()
	}
	runner := drainRunner(t, queue, handler, 1, time.Second, fixedRunnerNow())
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx) }()
	<-entered
	cancel()
	<-done
	if !slices.Equal(queue.completed, []string{"job-1"}) || len(queue.pending) != 1 {
		t.Fatalf("completed %v with %d still pending, want the in-flight job done and no new claim", queue.completed, len(queue.pending))
	}
}

// A handler outliving the drain is cancelled, and its lease is released on a fresh context, due now
// and without spending an attempt.
func TestDrainExpiryReleasesTheLeaseDueNow(t *testing.T) {
	now := fixedRunnerNow()
	queue := &drainQueue{pending: []testJob{{id: "job-1", userID: "user-1", kind: "kind", attempts: 1}}}
	entered := make(chan struct{})
	handler := func(ctx context.Context, _ testJob) error {
		close(entered)
		<-ctx.Done()
		return ctx.Err()
	}
	runner := drainRunner(t, queue, handler, 1, 20*time.Millisecond, now)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx) }()
	<-entered
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("the runner did not return after the drain expired")
	}
	if len(queue.completed) != 0 || !queue.retried["job-1"].Equal(now) || queue.attempts["job-1"] != 1 {
		t.Fatalf("aborted job: completed %v, retried at %v with %d attempts; want released due now with 1",
			queue.completed, queue.retried["job-1"], queue.attempts["job-1"])
	}
	if len(queue.retryCtx) != 1 || queue.retryCtx[0] != nil {
		t.Fatalf("release ran on a cancelled context: %v", queue.retryCtx)
	}
}
