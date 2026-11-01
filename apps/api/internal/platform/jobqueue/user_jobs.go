package jobqueue

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/cosimosi/api/internal/platform"
	"time"
)

var ErrUserJobSpecInvalid = errors.New("user job identity, scope or schedule is invalid")

type UserJobIdentity struct {
	kind     Kind
	dedupKey string
}

func NewUserJobIdentity(kind Kind, key string) (UserJobIdentity, error) {
	if kind == "" || key == "" {
		return UserJobIdentity{}, ErrUserJobSpecInvalid
	}
	return UserJobIdentity{kind: kind, dedupKey: key}, nil
}
func (i UserJobIdentity) Kind() Kind       { return i.kind }
func (i UserJobIdentity) DedupKey() string { return i.dedupKey }

type UserJobStore interface {
	EnqueueJob(context.Context, platform.UserScope, Record) (Record, error)
	CancelUserJob(context.Context, platform.UserScope, Kind, string) error
}
type UserScheduler struct {
	store UserJobStore
	now   func() time.Time
	newID func() string
}

func NewUserScheduler(store UserJobStore, now func() time.Time, newID func() string) (UserScheduler, error) {
	if store == nil {
		return UserScheduler{}, errors.New("user job scheduler requires a store")
	}
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	if newID == nil {
		newID = platform.NewID
	}
	return UserScheduler{store: store, now: now, newID: newID}, nil
}
func (s UserScheduler) Schedule(ctx context.Context, scope platform.UserScope, identity UserJobIdentity, due time.Time) error {
	if scope.UserID() == "" || identity.kind == "" || identity.dedupKey == "" || due.IsZero() {
		return ErrUserJobSpecInvalid
	}
	key := identity.dedupKey
	_, err := s.store.EnqueueJob(ctx, scope, Record{ID: s.newID(), UserID: scope.UserID(), Kind: identity.kind,
		Payload: []byte(`{}`), Status: StatusPending, NextRunAt: due.UTC(), CreatedAt: s.now().UTC(),
		DedupKey: &key, Targets: []Target{{Kind: TargetUser, ID: scope.UserID()}}})
	return err
}
func (s UserScheduler) Cancel(ctx context.Context, scope platform.UserScope, identity UserJobIdentity) error {
	if scope.UserID() == "" || identity.kind == "" || identity.dedupKey == "" {
		return ErrUserJobSpecInvalid
	}
	return s.store.CancelUserJob(ctx, scope, identity.kind, identity.dedupKey)
}
func ValidateUserJob(job Record) error {
	if job.UserID == "" || len(job.Targets) != 1 || job.Targets[0].Kind != TargetUser ||
		job.Targets[0].ID != job.UserID || job.Targets[0].ExpectedRevision != 0 {
		return ErrUserJobSpecInvalid
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(job.Payload, &payload); err != nil || payload == nil || len(payload) != 0 {
		return ErrUserJobSpecInvalid
	}
	return nil
}

type jobContextKey struct{}

func ContextWithJob(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, jobContextKey{}, id)
}
func CurrentJobID(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(jobContextKey{}).(string)
	return id, ok && id != ""
}
