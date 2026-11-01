package account

import (
	"context"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"time"
)

const WithdrawalJobKind jobqueue.Kind = "withdrawal_sweep"

func WithdrawalSweepJobIdentity(scope platform.UserScope) (jobqueue.UserJobIdentity, error) {
	if scope.UserID() == "" {
		return jobqueue.UserJobIdentity{}, ErrScopeRequired
	}
	return jobqueue.NewUserJobIdentity(WithdrawalJobKind, "withdrawal:"+scope.UserID())
}

type WithdrawalJobScheduler struct{ queue jobqueue.UserScheduler }

func NewWithdrawalJobScheduler(store jobqueue.UserJobStore, now func() time.Time, newID func() string) (WithdrawalJobScheduler, error) {
	queue, err := jobqueue.NewUserScheduler(store, now, newID)
	return WithdrawalJobScheduler{queue: queue}, err
}
func (s WithdrawalJobScheduler) Schedule(ctx context.Context, scope platform.UserScope, due time.Time) error {
	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		return err
	}
	return s.queue.Schedule(ctx, scope, identity, due)
}
func (s WithdrawalJobScheduler) Cancel(ctx context.Context, scope platform.UserScope) error {
	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		return err
	}
	return s.queue.Cancel(ctx, scope, identity)
}

func WithdrawalSweepJobID(ctx context.Context) (string, bool) { return jobqueue.CurrentJobID(ctx) }

type DueWithdrawalSweeper interface {
	SweepWithdrawnAccount(context.Context, platform.UserScope, time.Time) error
}

func NewWithdrawalSweepJobHandler(sweeper DueWithdrawalSweeper, now func() time.Time) jobqueue.Handler[jobqueue.Record] {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return func(ctx context.Context, job jobqueue.Record) error {
		if err := jobqueue.ValidateUserJob(job); err != nil {
			return err
		}
		scope, err := platform.NewUserScope(job.UserID)
		if err != nil {
			return err
		}
		return sweeper.SweepWithdrawnAccount(jobqueue.ContextWithJob(ctx, job.ID), scope, now())
	}
}
