package achievement

import (
	"context"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"time"
)

const SettlementJobKind jobqueue.Kind = "achievement_settle"

func SettlementJobIdentity(scope platform.UserScope, achievementID string) (jobqueue.UserJobIdentity, error) {
	if scope.UserID() == "" || achievementID == "" {
		return jobqueue.UserJobIdentity{}, jobqueue.ErrUserJobSpecInvalid
	}
	return jobqueue.NewUserJobIdentity(SettlementJobKind, "achievement_settle:"+scope.UserID()+":"+achievementID)
}

type SettlementJobScheduler struct {
	queue jobqueue.UserScheduler
	now   func() time.Time
}

func NewSettlementJobScheduler(store jobqueue.UserJobStore, now func() time.Time, newID func() string) (SettlementJobScheduler, error) {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	queue, err := jobqueue.NewUserScheduler(store, now, newID)
	return SettlementJobScheduler{queue: queue, now: now}, err
}
func (s SettlementJobScheduler) Schedule(ctx context.Context, scope platform.UserScope, achievementID string) error {
	identity, err := SettlementJobIdentity(scope, achievementID)
	if err != nil {
		return err
	}
	return s.queue.Schedule(ctx, scope, identity, s.now())
}

type DueClaimSettler interface {
	SettleClaims(context.Context, platform.UserScope) error
}

func NewSettlementJobHandler(settler DueClaimSettler) jobqueue.Handler[jobqueue.Record] {
	return func(ctx context.Context, job jobqueue.Record) error {
		if err := jobqueue.ValidateUserJob(job); err != nil {
			return err
		}
		scope, err := platform.NewUserScope(job.UserID)
		if err != nil {
			return err
		}
		return settler.SettleClaims(ctx, scope)
	}
}
