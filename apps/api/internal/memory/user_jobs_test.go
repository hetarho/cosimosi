package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

type fakeUserJobStore struct {
	enqueued  []Job
	cancelled []struct {
		userID   string
		kind     JobKind
		dedupKey string
	}
}

func (f *fakeUserJobStore) EnqueueJob(
	_ context.Context,
	_ platform.UserScope,
	job Job,
) (Job, error) {
	f.enqueued = append(f.enqueued, job)
	return job, nil
}

func (f *fakeUserJobStore) CancelUserJob(
	_ context.Context,
	scope platform.UserScope,
	kind JobKind,
	dedupKey string,
) error {
	f.cancelled = append(f.cancelled, struct {
		userID   string
		kind     JobKind
		dedupKey string
	}{userID: scope.UserID(), kind: kind, dedupKey: dedupKey})
	return nil
}

func TestUserJobServiceOwnsWithdrawalPayloadAndTargetShape(t *testing.T) {
	now := time.Date(2026, 7, 26, 1, 2, 3, 0, time.UTC)
	dueAt := now.Add(30 * 24 * time.Hour)
	store := &fakeUserJobStore{}
	service, err := NewUserJobService(
		store,
		func() time.Time { return now },
		func() string { return "withdrawal-job" },
	)
	if err != nil {
		t.Fatalf("NewUserJobService failed: %v", err)
	}
	scope, err := platform.NewUserScope("withdrawal-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	if err := service.ScheduleUserJob(context.Background(), scope, UserJobSpec{
		Kind:     JobKindWithdrawal,
		DedupKey: "withdrawal:withdrawal-user",
		DueAt:    dueAt,
	}); err != nil {
		t.Fatalf("ScheduleUserJob failed: %v", err)
	}
	if len(store.enqueued) != 1 {
		t.Fatalf("enqueued jobs = %d, want 1", len(store.enqueued))
	}
	job := store.enqueued[0]
	if job.ID != "withdrawal-job" ||
		job.UserID != scope.UserID() ||
		job.Kind != JobKindWithdrawal ||
		string(job.Payload) != "{}" ||
		job.DedupKey == nil ||
		*job.DedupKey != "withdrawal:withdrawal-user" ||
		!job.NextRunAt.Equal(dueAt) ||
		len(job.Targets) != 1 ||
		job.Targets[0].Kind != JobTargetUser ||
		job.Targets[0].ID != scope.UserID() ||
		job.Targets[0].ExpectedRevision != 0 {
		t.Fatalf("withdrawal job = %#v", job)
	}

	if err := service.CancelUserJob(
		context.Background(),
		scope,
		JobKindWithdrawal,
		"withdrawal:withdrawal-user",
	); err != nil {
		t.Fatalf("CancelUserJob failed: %v", err)
	}
	if len(store.cancelled) != 1 ||
		store.cancelled[0].userID != scope.UserID() ||
		store.cancelled[0].kind != JobKindWithdrawal ||
		store.cancelled[0].dedupKey != "withdrawal:withdrawal-user" {
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
	f.jobID, _ = WithdrawalSweepJobID(ctx)
	f.userID = scope.UserID()
	f.now = now
	return nil
}

func TestWithdrawalJobHandlerValidatesIdentityTargetAndPublishesInFlightJobID(t *testing.T) {
	now := time.Date(2026, 8, 25, 1, 2, 3, 0, time.UTC)
	sweeper := &fakeWithdrawalSweeper{}
	handler := NewWithdrawalSweepJobHandler(sweeper, func() time.Time { return now })
	job := Job{
		ID:      "withdrawal-job",
		UserID:  "withdrawal-user",
		Kind:    JobKindWithdrawal,
		Payload: []byte(`{}`),
		Targets: []JobTarget{{
			Kind: JobTargetUser,
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
	if err := handler(context.Background(), job); !errors.Is(err, ErrJobPayload) {
		t.Fatalf("forged target error = %v, want ErrJobPayload", err)
	}
}

func TestNewJobRunnerRejectsDuplicateExtraHandlerKind(t *testing.T) {
	_, err := NewJobRunner(
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		WorkerConfig{},
		map[JobKind]jobqueue.Handler[Job]{
			JobKindEmbed: func(context.Context, Job) error { return nil },
		},
	)
	if !errors.Is(err, ErrDuplicateJobHandler) {
		t.Fatalf("NewJobRunner error = %v, want ErrDuplicateJobHandler", err)
	}
}
