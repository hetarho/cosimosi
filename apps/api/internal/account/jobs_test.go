package account

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

type fakeUserJobStore struct {
	enqueued  []jobqueue.Record
	cancelled []struct {
		userID   string
		kind     jobqueue.Kind
		dedupKey string
	}
}

func (f *fakeUserJobStore) EnqueueJob(
	_ context.Context,
	_ platform.UserScope,
	job jobqueue.Record,
) (jobqueue.Record, error) {
	f.enqueued = append(f.enqueued, job)
	return job, nil
}

func (f *fakeUserJobStore) CancelUserJob(
	_ context.Context,
	scope platform.UserScope,
	kind jobqueue.Kind,
	dedupKey string,
) error {
	f.cancelled = append(f.cancelled, struct {
		userID   string
		kind     jobqueue.Kind
		dedupKey string
	}{userID: scope.UserID(), kind: kind, dedupKey: dedupKey})
	return nil
}

func TestUserJobServiceOwnsWithdrawalPayloadAndTargetShape(t *testing.T) {
	now := time.Date(2026, 7, 26, 1, 2, 3, 0, time.UTC)
	dueAt := now.Add(30 * 24 * time.Hour)
	store := &fakeUserJobStore{}
	service, err := NewWithdrawalJobScheduler(
		store,
		func() time.Time { return now },
		func() string { return "withdrawal-job" },
	)
	if err != nil {
		t.Fatalf("NewWithdrawalJobScheduler failed: %v", err)
	}
	scope, err := platform.NewUserScope("withdrawal-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatalf("WithdrawalSweepJobIdentity failed: %v", err)
	}
	if err := service.Schedule(context.Background(), scope, dueAt); err != nil {
		t.Fatalf("Schedule failed: %v", err)
	}
	if len(store.enqueued) != 1 {
		t.Fatalf("enqueued jobs = %d, want 1", len(store.enqueued))
	}
	job := store.enqueued[0]
	if job.ID != "withdrawal-job" ||
		job.UserID != scope.UserID() ||
		job.Kind != WithdrawalJobKind ||
		string(job.Payload) != "{}" ||
		job.DedupKey == nil ||
		*job.DedupKey != identity.DedupKey() ||
		!job.NextRunAt.Equal(dueAt) ||
		len(job.Targets) != 1 ||
		job.Targets[0].Kind != jobqueue.TargetUser ||
		job.Targets[0].ID != scope.UserID() ||
		job.Targets[0].ExpectedRevision != 0 {
		t.Fatalf("withdrawal job = %#v", job)
	}

	if err := service.Cancel(context.Background(), scope); err != nil {
		t.Fatalf("Cancel failed: %v", err)
	}
	if len(store.cancelled) != 1 ||
		store.cancelled[0].userID != scope.UserID() ||
		store.cancelled[0].kind != identity.Kind() ||
		store.cancelled[0].dedupKey != *job.DedupKey {
		t.Fatalf("cancelled jobs = %#v", store.cancelled)
	}
}

type fakeWithdrawalSweeper struct {
	jobID  string
	userID string
	now    time.Time
}

func (f *fakeWithdrawalSweeper) SweepWithdrawnAccount(
	ctx context.Context,
	scope platform.UserScope,
	now time.Time,
) error {
	f.jobID, _ = withdrawalSweepJobID(ctx)
	f.userID = scope.UserID()
	f.now = now
	return nil
}

func TestWithdrawalJobHandlerValidatesIdentityTargetAndPublishesInFlightJobID(t *testing.T) {
	now := time.Date(2026, 8, 25, 1, 2, 3, 0, time.UTC)
	sweeper := &fakeWithdrawalSweeper{}
	handler := NewWithdrawalSweepJobHandler(sweeper, func() time.Time { return now })
	job := jobqueue.Record{
		ID:      "withdrawal-job",
		UserID:  "withdrawal-user",
		Kind:    WithdrawalJobKind,
		Payload: []byte(`{}`),
		Targets: []jobqueue.Target{{
			Kind: jobqueue.TargetUser,
			ID:   "withdrawal-user",
		}},
	}
	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("withdrawal handler failed: %v", err)
	}
	if sweeper.jobID != job.ID || sweeper.userID != job.UserID || !sweeper.now.Equal(now) {
		t.Fatalf("sweep call = job %q user %q now %v", sweeper.jobID, sweeper.userID, sweeper.now)
	}

	job.Targets[0].ID = "other-user"
	if err := handler(context.Background(), job); !errors.Is(err, jobqueue.ErrUserJobSpecInvalid) {
		t.Fatalf("forged target error = %v, want jobqueue.ErrUserJobSpecInvalid", err)
	}
}

// Persisted job rows name their kind by this string; renaming it would strand every queued job.
func TestWithdrawalJobKindIsPinned(t *testing.T) {
	if WithdrawalJobKind != "withdrawal_sweep" {
		t.Fatalf("WithdrawalJobKind = %q, want %q", WithdrawalJobKind, "withdrawal_sweep")
	}
}
