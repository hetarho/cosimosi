package account

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

type fakeUserJobStore struct {
	enqueued  []jobqueue.Record
	rearmed   []jobqueue.Record
	returned  *jobqueue.Record
	err       error
	cancelled []struct {
		userID   string
		kind     jobqueue.Kind
		dedupKey string
	}
}

func (f *fakeUserJobStore) EnqueueOrRearmCompletedUserJob(_ context.Context, _ platform.UserScope, job jobqueue.Record) (jobqueue.Record, error) {
	f.rearmed = append(f.rearmed, job)
	if f.err != nil {
		return jobqueue.Record{}, f.err
	}
	if f.returned != nil {
		return *f.returned, nil
	}
	return job, nil
}

func TestWithdrawalRecoveryValidatesReturnedEnvelope(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	scope := mustScope(t, "withdraw-user")
	identity, _ := WithdrawalSweepJobIdentity(scope)
	cases := []struct {
		name   string
		mutate func(*jobqueue.Record)
		valid  bool
	}{
		{"pending", func(*jobqueue.Record) {}, true},
		{"running", func(j *jobqueue.Record) { j.Status = jobqueue.StatusRunning }, true},
		{"empty id", func(j *jobqueue.Record) { j.ID = "" }, false},
		{"other user", func(j *jobqueue.Record) { j.UserID = "other" }, false},
		{"other kind", func(j *jobqueue.Record) { j.Kind = "other" }, false},
		{"missing key", func(j *jobqueue.Record) { j.DedupKey = nil }, false},
		{"other key", func(j *jobqueue.Record) { key := "other"; j.DedupKey = &key }, false},
		{"done", func(j *jobqueue.Record) { j.Status = jobqueue.StatusDone }, false},
		{"failed", func(j *jobqueue.Record) { j.Status = jobqueue.StatusFailed }, false},
		{"cancelled", func(j *jobqueue.Record) { j.Status = jobqueue.StatusCanceled }, false},
		{"terminal active", func(j *jobqueue.Record) { j.TerminalAt = &now }, false},
		{"null payload", func(j *jobqueue.Record) { j.Payload = []byte(`null`) }, false},
		{"array payload", func(j *jobqueue.Record) { j.Payload = []byte(`[]`) }, false},
		{"nonempty payload", func(j *jobqueue.Record) { j.Payload = []byte(`{"value":1}`) }, false},
		{"invalid payload", func(j *jobqueue.Record) { j.Payload = []byte(`{`) }, false},
		{"missing target", func(j *jobqueue.Record) { j.Targets = nil }, false},
		{"extra target", func(j *jobqueue.Record) { j.Targets = append(j.Targets, j.Targets[0]) }, false},
		{"other target kind", func(j *jobqueue.Record) { j.Targets[0].Kind = jobqueue.TargetMemory }, false},
		{"other target user", func(j *jobqueue.Record) { j.Targets[0].ID = "other" }, false},
		{"revision target", func(j *jobqueue.Record) { j.Targets[0].ExpectedRevision = 1 }, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := identity.DedupKey()
			returned := jobqueue.Record{ID: "existing", UserID: scope.UserID(), Kind: identity.Kind(), DedupKey: &key,
				Status: jobqueue.StatusPending, Payload: []byte(`{}`), Targets: []jobqueue.Target{{Kind: jobqueue.TargetUser, ID: scope.UserID()}}}
			tc.mutate(&returned)
			store := &fakeUserJobStore{returned: &returned}
			scheduler, err := NewWithdrawalJobScheduler(store, func() time.Time { return now }, func() string { return "new" })
			if err != nil {
				t.Fatal(err)
			}
			err = scheduler.Schedule(context.Background(), scope, now.Add(time.Hour))
			if (err == nil) != tc.valid || len(store.rearmed) != 1 || len(store.enqueued) != 0 || len(store.cancelled) != 0 {
				t.Fatalf("Schedule = %v, recovery=%d enqueue=%d cancel=%d; valid=%v", err, len(store.rearmed), len(store.enqueued), len(store.cancelled), tc.valid)
			}
		})
	}
}

func TestRearmingSchedulerKeepsValidationAndMintOrdering(t *testing.T) {
	if _, err := NewWithdrawalJobScheduler(nil, nil, nil); err == nil {
		t.Fatal("nil recovery store accepted")
	}
	store := &fakeUserJobStore{}
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	var calls []string
	scheduler, err := jobqueue.NewRearmingUserScheduler(store, func() time.Time { calls = append(calls, "clock"); return now }, func() string { calls = append(calls, "id"); return "new" })
	if err != nil {
		t.Fatal(err)
	}
	scope := mustScope(t, "withdraw-user")
	identity, _ := WithdrawalSweepJobIdentity(scope)
	for _, input := range []struct {
		scope    platform.UserScope
		identity jobqueue.UserJobIdentity
		due      time.Time
	}{
		{platform.UserScope{}, identity, now}, {scope, jobqueue.UserJobIdentity{}, now}, {scope, identity, time.Time{}},
	} {
		if err := scheduler.Schedule(context.Background(), input.scope, input.identity, input.due); !errors.Is(err, jobqueue.ErrUserJobSpecInvalid) {
			t.Fatalf("invalid schedule = %v", err)
		}
	}
	if len(calls) != 0 || len(store.rearmed) != 0 {
		t.Fatal("invalid input reached mint, clock or store")
	}
	if err := scheduler.Schedule(context.Background(), scope, identity, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(calls, []string{"id", "clock"}) {
		t.Fatalf("construction order = %v", calls)
	}
	store.err = errors.New("recovery unavailable")
	if err := scheduler.Schedule(context.Background(), scope, identity, now); !errors.Is(err, store.err) {
		t.Fatalf("store error = %v", err)
	}
	defaults, err := NewWithdrawalJobScheduler(&fakeUserJobStore{}, nil, nil)
	if err != nil || defaults.Schedule(context.Background(), scope, now) != nil {
		t.Fatalf("default construction failed: %v", err)
	}
}

func TestOrdinaryUserSchedulerKeepsTerminalDedupPolicy(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	store := &fakeUserJobStore{returned: &jobqueue.Record{Status: jobqueue.StatusDone, TerminalAt: &now}}
	scheduler, err := jobqueue.NewUserScheduler(store, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	scope := mustScope(t, "withdraw-user")
	identity, _ := WithdrawalSweepJobIdentity(scope)
	if err := scheduler.Schedule(context.Background(), scope, identity, now); err != nil {
		t.Fatal(err)
	}
	if len(store.enqueued) != 1 || len(store.rearmed) != 0 || store.returned.Status != jobqueue.StatusDone {
		t.Fatal("ordinary scheduler opted into recovery")
	}
}

func (f *fakeUserJobStore) EnqueueJob(
	_ context.Context,
	_ platform.UserScope,
	job jobqueue.Record,
) (jobqueue.Record, error) {
	f.enqueued = append(f.enqueued, job)
	if f.returned != nil {
		return *f.returned, nil
	}
	return job, nil
}

func TestWithdrawRejectsInactiveScheduledTriggerBeforeMark(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	scope := mustScope(t, "withdraw-user")
	identity, err := WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatal(err)
	}
	key := identity.DedupKey()
	queue := &fakeUserJobStore{returned: &jobqueue.Record{
		ID: "completed-inert-trigger", UserID: scope.UserID(), Kind: identity.Kind(),
		DedupKey: &key, Payload: []byte(`{}`), Status: jobqueue.StatusDone, TerminalAt: &now,
		Targets: []jobqueue.Target{{Kind: jobqueue.TargetUser, ID: scope.UserID()}},
	}}
	scheduler, err := NewWithdrawalJobScheduler(queue, func() time.Time { return now }, func() string { return "unused-new-id" })
	if err != nil {
		t.Fatal(err)
	}
	store := &fakeWithdrawalStore{found: true}
	service := newWithdrawalTestService(t, store, scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}}, &fakeCredentialDirectory{}, now)
	_, err = service.Withdraw(context.Background(), scope)
	if err == nil || !store.withdrawnAt.IsZero() {
		t.Fatalf("inactive scheduled result: err=%v, withdrawn_at=%v; want refusal before mark", err, store.withdrawnAt)
	}
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
	if len(store.rearmed) != 1 || len(store.enqueued) != 0 {
		t.Fatalf("recovery jobs = %d, ordinary enqueue calls = %d; want 1 and 0", len(store.rearmed), len(store.enqueued))
	}
	job := store.rearmed[0]
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
