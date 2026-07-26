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

type UserJobSpec struct {
	Kind     JobKind
	DedupKey string
	DueAt    time.Time
}

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

func (s UserJobService) ScheduleUserJob(
	ctx context.Context,
	scope platform.UserScope,
	spec UserJobSpec,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if spec.Kind != JobKindWithdrawal || spec.DedupKey == "" || spec.DueAt.IsZero() {
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

func (s UserJobService) CancelUserJob(
	ctx context.Context,
	scope platform.UserScope,
	kind JobKind,
	dedupKey string,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if kind != JobKindWithdrawal || dedupKey == "" {
		return ErrUserJobSpecInvalid
	}
	return s.store.CancelUserJob(ctx, scope, kind, dedupKey)
}
