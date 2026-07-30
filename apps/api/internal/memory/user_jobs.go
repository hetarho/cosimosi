package memory

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrUserJobStoreRequired = errors.New("memory user-job service requires a store")
	ErrUserJobSpecInvalid   = errors.New("memory user-job spec is invalid")
)

type userJobSpec struct {
	Kind     JobKind
	DedupKey string
	DueAt    time.Time
}

type UserJobIdentity struct {
	kind     JobKind
	dedupKey string
}

// WithdrawalSweepJobIdentity is the single constructor for the durable identity shared by
// withdrawal enqueue and cancellation. Callers cannot supply a second kind or key shape.
func WithdrawalSweepJobIdentity(scope platform.UserScope) (UserJobIdentity, error) {
	if scope.UserID() == "" {
		return UserJobIdentity{}, ErrScopeRequired
	}
	return UserJobIdentity{
		kind:     JobKindWithdrawal,
		dedupKey: "withdrawal:" + scope.UserID(),
	}, nil
}

// AchievementSettleJobIdentity is the settle drain's durable identity. It is keyed per CLAIM rather
// than per user because the enqueue dedups against terminal rows too: a per-user key would let one
// finished drain swallow the next claim's, for as long as the terminal row survives cleanup.
func AchievementSettleJobIdentity(scope platform.UserScope, achievementID string) (UserJobIdentity, error) {
	if scope.UserID() == "" {
		return UserJobIdentity{}, ErrScopeRequired
	}
	if achievementID == "" {
		return UserJobIdentity{}, ErrUserJobSpecInvalid
	}
	return UserJobIdentity{
		kind:     JobKindAchievementSettle,
		dedupKey: "achievement_settle:" + scope.UserID() + ":" + achievementID,
	}, nil
}

func (i UserJobIdentity) Kind() JobKind    { return i.kind }
func (i UserJobIdentity) DedupKey() string { return i.dedupKey }

type UserJobStore interface {
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
	CancelUserJob(ctx context.Context, scope platform.UserScope, kind JobKind, dedupKey string) error
}

// UserJobService publishes an identity-only scheduling seam while jobs remain
// memory-owned. No caller can provide a payload or target shape.
type UserJobService struct {
	store UserJobStore
	now   func() time.Time
	newID func() string
}

func NewUserJobService(store UserJobStore, now func() time.Time, newID func() string) (UserJobService, error) {
	if store == nil {
		return UserJobService{}, ErrUserJobStoreRequired
	}
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	if newID == nil {
		newID = platform.NewID
	}
	return UserJobService{store: store, now: now, newID: newID}, nil
}

// Schedule implements account's withdrawal scheduler port without exposing memory's generic
// queue shape to either composition root.
func (s UserJobService) Schedule(
	ctx context.Context,
	scope platform.UserScope,
	dueAt time.Time,
) error {
	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		return err
	}
	return s.scheduleUserJob(ctx, scope, userJobSpec{
		Kind:     identity.Kind(),
		DedupKey: identity.DedupKey(),
		DueAt:    dueAt,
	})
}

// ScheduleAchievementSettlement arms the drain for one claimed reward, due immediately. It is
// separate from Schedule because the two identities are separate: no caller can pass a kind, so a
// producer cannot enqueue into another leg's vocabulary by mistake.
func (s UserJobService) ScheduleAchievementSettlement(
	ctx context.Context,
	scope platform.UserScope,
	achievementID string,
) error {
	identity, err := AchievementSettleJobIdentity(scope, achievementID)
	if err != nil {
		return err
	}
	return s.scheduleUserJob(ctx, scope, userJobSpec{
		Kind:     identity.Kind(),
		DedupKey: identity.DedupKey(),
		DueAt:    s.now().UTC(),
	})
}

// userJobKinds is the closed set this seam may enqueue. It exists so admitting a new leg is one edit
// beside its identity constructor, and so nothing else in the queue's vocabulary can be reached from
// a user-scoped scheduler.
func userJobKind(kind JobKind) bool {
	return kind == JobKindWithdrawal || kind == JobKindAchievementSettle
}

func (s UserJobService) scheduleUserJob(
	ctx context.Context,
	scope platform.UserScope,
	spec userJobSpec,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if !userJobKind(spec.Kind) || spec.DedupKey == "" || spec.DueAt.IsZero() {
		return ErrUserJobSpecInvalid
	}
	dedupKey := spec.DedupKey
	_, err := s.store.EnqueueJob(ctx, scope, Job{
		ID:        s.newID(),
		UserID:    scope.UserID(),
		Kind:      spec.Kind,
		Payload:   []byte(`{}`),
		Status:    JobStatusPending,
		NextRunAt: spec.DueAt.UTC(),
		CreatedAt: s.now().UTC(),
		DedupKey:  &dedupKey,
		Targets: []JobTarget{{
			Kind: JobTargetUser,
			ID:   scope.UserID(),
		}},
	})
	return err
}

// Cancel derives the same memory-owned identity as Schedule, making enqueue/cancel drift
// unrepresentable in API and worker composition.
func (s UserJobService) Cancel(ctx context.Context, scope platform.UserScope) error {
	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		return err
	}
	return s.store.CancelUserJob(ctx, scope, identity.Kind(), identity.DedupKey())
}
