package jobqueue

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// leaseReleaseTimeout bounds the one write that returns a shutdown-aborted job to the queue.
const leaseReleaseTimeout = 5 * time.Second

var (
	ErrNoJob                 = errors.New("job queue has no due job")
	ErrInvalidRegistration   = errors.New("job registration needs a kind and a non-nil handler")
	ErrDuplicateRegistration = errors.New("job kind is already registered")
)

// DefaultPollInterval is the deployment-shaped worker polling default. Composition roots pass it
// explicitly so production and the opt-in development worker share one named fallback.
const DefaultPollInterval = time.Second

type Job interface {
	JobID() string
	JobUserID() string
	JobKind() string
	JobAttempts() int32
	// JobLeaseGeneration is the claim count / fence token; the runner dead-letters a job
	// that keeps being re-claimed past MaxClaims without ever completing.
	JobLeaseGeneration() int64
}

// DeadLetterCause names why the runner is stopping a job that never finished. It exists so a queue
// wrapper can tell a POLICY give-up (attempts spent — `Fail`) from a SAFETY stop, which no retry
// policy may override: the cases below are not "this job failed a few times", they are "running this
// job again cannot help, and running it forever costs the whole queue".
type DeadLetterCause string

const (
	// DeadLetterClaimCeiling: re-claimed past MaxClaims without ever finishing — the signature of a
	// handler that kills its worker before any failure can be recorded.
	DeadLetterClaimCeiling DeadLetterCause = "claim_ceiling"
	// DeadLetterUnhandledKind: no handler is registered for the kind. Retrying cannot grow one.
	DeadLetterUnhandledKind DeadLetterCause = "unhandled_kind"
)

type Queue[J Job] interface {
	// ClaimDue leases the next due job until now+lease; a job whose lease lapses is claimable again.
	ClaimDue(ctx context.Context, now time.Time, lease time.Duration) (J, error)
	Complete(ctx context.Context, job J) error
	Retry(ctx context.Context, job J, nextAttempts int32, nextRunAt time.Time) error
	// Fail ends a job whose retry budget is spent. The runner never calls it for a retry-forever kind.
	Fail(ctx context.Context, job J, nextAttempts int32) error
	// DeadLetter ends a job the runner is refusing to run again, whatever the retry policy says.
	DeadLetter(ctx context.Context, job J, cause DeadLetterCause) error
}

type Handler[J Job] func(context.Context, J) error

type retryAtError interface {
	RetryAt() time.Time
}

// Registration is one job kind's handler and retry policy, published by the context that produces
// the kind and composed by the roots.
//
// RetryForever marks a kind that is the only durable trigger for something the user cannot ask for
// a second time: a spent retry budget re-queues it at the base backoff instead of failing it. It
// covers that POLICY give-up alone. The claim ceiling and the unhandled-kind stop are safety
// transitions no retry policy overrides, or a job that kills its worker would loop at the head of
// the queue forever.
type Registration[J Job] struct {
	Handler      Handler[J]
	RetryForever bool
}

// Registrations merges each producer's registrations, refusing a malformed entry or a kind two
// producers claim: silently dropping either would leave a worker that never runs that kind.
func Registrations[J Job](sets ...map[string]Registration[J]) (map[string]Registration[J], error) {
	merged := map[string]Registration[J]{}
	for _, set := range sets {
		for kind, registration := range set {
			if kind == "" || registration.Handler == nil {
				return nil, ErrInvalidRegistration
			}
			if _, exists := merged[kind]; exists {
				return nil, fmt.Errorf("%w: %s", ErrDuplicateRegistration, kind)
			}
			merged[kind] = registration
		}
	}
	return merged, nil
}

type Config struct {
	// Lease only has to outlast one handler run — long enough that a healthy worker finishes before
	// another can re-claim, short enough that a dead worker's job frees up promptly. It is its own
	// knob, not coupled to the retry backoff.
	Lease        time.Duration
	MaxAttempts  int32
	MaxClaims    int32
	BackoffBase  time.Duration
	PollInterval time.Duration
	// Lanes is how many claim-and-run loops share the queue: SKIP LOCKED claims and the lease fence
	// keep two lanes from running one job. Zero means one.
	Lanes int
	// DrainTimeout bounds how long an in-flight handler keeps running once the run context ends;
	// claiming stops at once. Zero cancels in-flight handlers with the run context.
	DrainTimeout time.Duration
	Now          func() time.Time
	Logger       *log.Logger
}

type Runner[J Job] struct {
	queue         Queue[J]
	registrations map[string]Registration[J]
	lease         time.Duration
	maxAttempts   int32
	maxClaims     int32
	backoffBase   time.Duration
	pollInterval  time.Duration
	lanes         int
	drainTimeout  time.Duration
	now           func() time.Time
	logger        *log.Logger
}

func NewRunner[J Job](queue Queue[J], registrations map[string]Registration[J], cfg Config) (Runner[J], error) {
	if queue == nil {
		return Runner[J]{}, errors.New("job runner requires a queue")
	}
	if cfg.Lease <= 0 {
		return Runner[J]{}, errors.New("job runner requires a positive lease")
	}
	if cfg.MaxAttempts <= 0 {
		return Runner[J]{}, errors.New("job runner requires a positive max attempts")
	}
	if cfg.BackoffBase <= 0 {
		return Runner[J]{}, errors.New("job runner requires a positive backoff base")
	}
	pollInterval := cfg.PollInterval
	if pollInterval <= 0 {
		pollInterval = DefaultPollInterval
	}
	now := cfg.Now
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	copied, err := Registrations(registrations)
	if err != nil {
		return Runner[J]{}, err
	}
	return Runner[J]{
		queue:         queue,
		registrations: copied,
		lease:         cfg.Lease,
		maxAttempts:   cfg.MaxAttempts,
		maxClaims:     cfg.MaxClaims,
		backoffBase:   cfg.BackoffBase,
		pollInterval:  pollInterval,
		lanes:         max(cfg.Lanes, 1),
		drainTimeout:  max(cfg.DrainTimeout, 0),
		now:           now,
		logger:        cfg.Logger,
	}, nil
}

// Run runs the configured lanes until ctx ends, then waits for each lane's in-flight job to finish
// or be released.
func (r Runner[J]) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	errs := make([]error, r.lanes)
	for lane := range r.lanes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs[lane] = r.runLane(ctx)
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
			return err
		}
	}
	return ctx.Err()
}

func (r Runner[J]) runLane(ctx context.Context) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		worked, err := r.RunOnce(ctx)
		if err != nil {
			return err
		}
		if worked {
			continue
		}
		timer := time.NewTimer(r.pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
}

// RunOnce claims one due job and runs it. Claiming honours ctx; the claimed job's handler and its
// transition run on a drain context that outlives ctx by at most the drain timeout, so a shutdown
// lets in-flight work finish instead of stranding it until its lease expires.
func (r Runner[J]) RunOnce(ctx context.Context) (bool, error) {
	job, err := r.queue.ClaimDue(ctx, r.now(), r.lease)
	if errors.Is(err, ErrNoJob) {
		return false, nil
	}
	if err != nil {
		if shouldStop(ctx, err) {
			return false, err
		}
		r.logf("job claim failed: %v", err)
		return false, nil
	}
	work, release := r.drainContext(ctx)
	defer release()
	r.process(ctx, work, job)
	return true, nil
}

// drainContext detaches the claimed job's work from ctx: when ctx ends, the work keeps running for
// the drain timeout and is cancelled after it.
func (r Runner[J]) drainContext(ctx context.Context) (context.Context, func()) {
	work, cancel := context.WithCancel(context.WithoutCancel(ctx))
	var mu sync.Mutex
	var drain *time.Timer
	released := false
	stop := context.AfterFunc(ctx, func() {
		mu.Lock()
		defer mu.Unlock()
		if !released {
			drain = time.AfterFunc(r.drainTimeout, cancel)
		}
	})
	return work, func() {
		stop()
		mu.Lock()
		released = true
		if drain != nil {
			drain.Stop()
		}
		mu.Unlock()
		cancel()
	}
}

func (r Runner[J]) process(ctx context.Context, work context.Context, job J) {
	// Dead-letter a job that has been re-claimed past the hard claim ceiling without ever
	// finishing — the signature of a handler that kills its worker (panic that escapes,
	// OOM, SIGKILL) every run, which would otherwise loop forever since a killed worker
	// never records a failure.
	if !r.registrations[job.JobKind()].RetryForever && r.maxClaims > 0 && job.JobLeaseGeneration() > int64(r.maxClaims) {
		if err := r.queue.DeadLetter(work, job, DeadLetterClaimCeiling); err != nil {
			r.logf("job %s dead-letter transition failed: %v", job.JobID(), err)
			return
		}
		r.logf("job %s dead-lettered after %d claims", job.JobID(), job.JobLeaseGeneration())
		return
	}

	registration, ok := r.registrations[job.JobKind()]
	if !ok {
		if err := r.queue.DeadLetter(work, job, DeadLetterUnhandledKind); err != nil {
			r.logf("job %s dead-letter transition failed: %v", job.JobID(), err)
			return
		}
		r.logf("job %s dead-lettered: unhandled kind %q", job.JobID(), job.JobKind())
		return
	}

	handlerCtx := platform.ContextWithUserID(work, job.JobUserID())
	if err := r.invoke(registration.Handler, handlerCtx, job); err != nil {
		if work.Err() != nil {
			r.releaseAborted(ctx, job, err)
			return
		}
		if err := r.handleFailure(work, job, err); err != nil {
			r.logf("job %s failure transition failed: %v", job.JobID(), err)
		}
		return
	}
	if err := r.queue.Complete(work, job); err != nil {
		r.logf("job %s complete transition failed: %v", job.JobID(), err)
	}
}

// releaseAborted hands a job the shutdown cut off back to the queue, due now and without spending
// an attempt: the abort was the worker's, not the job's. It writes on a fresh context, because the
// one the handler ran on is the one that was cancelled.
func (r Runner[J]) releaseAborted(ctx context.Context, job J, cause error) {
	release, cancel := context.WithTimeout(context.WithoutCancel(ctx), leaseReleaseTimeout)
	defer cancel()
	if err := r.queue.Retry(release, job, job.JobAttempts(), r.now()); err != nil {
		r.logf("job %s aborted by shutdown and its lease release failed: %v", job.JobID(), err)
		return
	}
	r.logf("job %s aborted by shutdown, released due now: %v", job.JobID(), cause)
}

// invoke runs a handler, converting a panic into an ordinary failure so one bad job
// can't take down the worker process — the failure then flows through the normal
// attempt/backoff path and is eventually failed like any other.
func (r Runner[J]) invoke(handler Handler[J], ctx context.Context, job J) (err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("job handler panicked: %v", rec)
		}
	}()
	return handler(ctx, job)
}

func (r Runner[J]) handleFailure(ctx context.Context, job J, cause error) error {
	if nextRunAt, ok := scheduledRetryAt(cause); ok {
		if err := r.queue.Retry(ctx, job, job.JobAttempts(), nextRunAt); err != nil {
			return err
		}
		r.logf("job %s retry delayed until %s: %v", job.JobID(), nextRunAt.Format(time.RFC3339), cause)
		return nil
	}

	nextAttempts := r.nextAttempts(job)
	if nextAttempts >= r.maxAttempts && r.registrations[job.JobKind()].RetryForever {
		if err := r.queue.Retry(ctx, job, 0, r.now().Add(r.backoffBase)); err != nil {
			return err
		}
		r.logf("job %s spent its retry budget and is retried, its kind is durable: %v", job.JobID(), cause)
		return nil
	}
	if nextAttempts >= r.maxAttempts {
		if err := r.queue.Fail(ctx, job, nextAttempts); err != nil {
			return err
		}
		r.logf("job %s failed after %d attempts: %v", job.JobID(), nextAttempts, cause)
		return nil
	}
	nextRunAt := r.now().Add(r.backoffDelay(job.JobAttempts()))
	if err := r.queue.Retry(ctx, job, nextAttempts, nextRunAt); err != nil {
		return err
	}
	r.logf("job %s retry scheduled after attempt %d: %v", job.JobID(), nextAttempts, cause)
	return nil
}

func scheduledRetryAt(cause error) (time.Time, bool) {
	var target retryAtError
	if !errors.As(cause, &target) {
		return time.Time{}, false
	}
	nextRunAt := target.RetryAt()
	if nextRunAt.IsZero() {
		return time.Time{}, false
	}
	return nextRunAt, true
}

func shouldStop(ctx context.Context, err error) bool {
	if err == nil {
		return false
	}
	if ctx.Err() != nil {
		return true
	}
	return errors.Is(err, context.Canceled)
}

func (r Runner[J]) nextAttempts(job J) int32 {
	next := job.JobAttempts() + 1
	if next < 1 {
		return 1
	}
	return next
}

func (r Runner[J]) backoffDelay(attempts int32) time.Duration {
	if attempts <= 0 {
		return r.backoffBase
	}
	delay := r.backoffBase
	for i := int32(0); i < attempts; i++ {
		if delay > (1<<62)/2 {
			return time.Duration(1 << 62)
		}
		delay *= 2
	}
	return delay
}

func (r Runner[J]) logf(format string, args ...any) {
	if r.logger != nil {
		r.logger.Print(fmt.Sprintf(format, args...))
	}
}
