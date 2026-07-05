package jobqueue

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

var ErrNoJob = errors.New("job queue has no due job")

type Job interface {
	JobID() string
	JobUserID() string
	JobKind() string
	JobAttempts() int32
	// JobLeaseGeneration is the claim count / fence token; the runner dead-letters a job
	// that keeps being re-claimed past MaxClaims without ever completing.
	JobLeaseGeneration() int64
}

type Queue[J Job] interface {
	ClaimDue(ctx context.Context, now time.Time) (J, error)
	Complete(ctx context.Context, job J) error
	Retry(ctx context.Context, job J, nextAttempts int32, nextRunAt time.Time) error
	Fail(ctx context.Context, job J, nextAttempts int32) error
}

type Handler[J Job] func(context.Context, J) error

type retryAtError interface {
	RetryAt() time.Time
}

type Config struct {
	MaxAttempts  int32
	MaxClaims    int32
	BackoffBase  time.Duration
	PollInterval time.Duration
	Now          func() time.Time
	Logger       *log.Logger
}

type Runner[J Job] struct {
	queue        Queue[J]
	handlers     map[string]Handler[J]
	maxAttempts  int32
	maxClaims    int32
	backoffBase  time.Duration
	pollInterval time.Duration
	now          func() time.Time
	logger       *log.Logger
}

func NewRunner[J Job](queue Queue[J], handlers map[string]Handler[J], cfg Config) (Runner[J], error) {
	if queue == nil {
		return Runner[J]{}, errors.New("job runner requires a queue")
	}
	if cfg.MaxAttempts <= 0 {
		return Runner[J]{}, errors.New("job runner requires a positive max attempts")
	}
	if cfg.BackoffBase <= 0 {
		return Runner[J]{}, errors.New("job runner requires a positive backoff base")
	}
	pollInterval := cfg.PollInterval
	if pollInterval <= 0 {
		pollInterval = time.Second
	}
	now := cfg.Now
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	copiedHandlers := make(map[string]Handler[J], len(handlers))
	for kind, handler := range handlers {
		if kind != "" && handler != nil {
			copiedHandlers[kind] = handler
		}
	}
	return Runner[J]{
		queue:        queue,
		handlers:     copiedHandlers,
		maxAttempts:  cfg.MaxAttempts,
		maxClaims:    cfg.MaxClaims,
		backoffBase:  cfg.BackoffBase,
		pollInterval: pollInterval,
		now:          now,
		logger:       cfg.Logger,
	}, nil
}

func (r Runner[J]) Run(ctx context.Context) error {
	for {
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

func (r Runner[J]) RunOnce(ctx context.Context) (bool, error) {
	job, err := r.queue.ClaimDue(ctx, r.now())
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

	// Dead-letter a job that has been re-claimed past the hard claim ceiling without ever
	// finishing — the signature of a handler that kills its worker (panic that escapes,
	// OOM, SIGKILL) every run, which would otherwise loop forever since a killed worker
	// never records a failure.
	if r.maxClaims > 0 && job.JobLeaseGeneration() > int64(r.maxClaims) {
		if err := r.queue.Fail(ctx, job, job.JobAttempts()); err != nil {
			if shouldStop(ctx, err) {
				return true, err
			}
			r.logf("job %s fail transition failed: %v", job.JobID(), err)
			return true, nil
		}
		r.logf("job %s dead-lettered after %d claims", job.JobID(), job.JobLeaseGeneration())
		return true, nil
	}

	handler, ok := r.handlers[job.JobKind()]
	if !ok {
		nextAttempts := r.nextAttempts(job)
		if err := r.queue.Fail(ctx, job, nextAttempts); err != nil {
			if shouldStop(ctx, err) {
				return true, err
			}
			r.logf("job %s fail transition failed: %v", job.JobID(), err)
			return true, nil
		}
		r.logf("job %s failed: unhandled kind %q", job.JobID(), job.JobKind())
		return true, nil
	}

	handlerCtx := platform.ContextWithUserID(ctx, job.JobUserID())
	if err := r.invoke(handler, handlerCtx, job); err != nil {
		if err := r.handleFailure(ctx, job, err); err != nil {
			if shouldStop(ctx, err) {
				return true, err
			}
			r.logf("job %s failure transition failed: %v", job.JobID(), err)
		}
		return true, nil
	}
	if err := r.queue.Complete(ctx, job); err != nil {
		if shouldStop(ctx, err) {
			return true, err
		}
		r.logf("job %s complete transition failed: %v", job.JobID(), err)
	}
	return true, nil
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
