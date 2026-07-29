package account

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type fakeWithdrawalStore struct {
	withdrawnAt    time.Time
	found          bool
	markErr        error
	clearErr       error
	dependentsErr  error
	userErr        error
	events         *[]string
	dependentCalls int
	userCalls      int
	statusCalls    int
}

func (f *fakeWithdrawalStore) InWithdrawalTx(
	_ context.Context,
	fn func(WithdrawalStore) error,
) error {
	return fn(f)
}

func (f *fakeWithdrawalStore) WithdrawalStatus(
	context.Context,
	platform.UserScope,
) (time.Time, bool, error) {
	f.statusCalls++
	return f.withdrawnAt, f.found, nil
}

func (f *fakeWithdrawalStore) WithdrawalStatusForUpdate(
	context.Context,
	platform.UserScope,
) (time.Time, bool, error) {
	return f.withdrawnAt, f.found, nil
}

func (f *fakeWithdrawalStore) MarkWithdrawn(
	_ context.Context,
	_ platform.UserScope,
	at time.Time,
) (time.Time, bool, error) {
	if f.markErr != nil {
		return time.Time{}, false, f.markErr
	}
	if !f.found || !f.withdrawnAt.IsZero() {
		return time.Time{}, false, nil
	}
	f.withdrawnAt = at.UTC()
	return f.withdrawnAt, true, nil
}

func (f *fakeWithdrawalStore) ClearWithdrawal(
	_ context.Context,
	_ platform.UserScope,
	expected time.Time,
) (bool, error) {
	if f.clearErr != nil {
		return false, f.clearErr
	}
	if !f.found || f.withdrawnAt.IsZero() || !f.withdrawnAt.Equal(expected) {
		return false, nil
	}
	f.withdrawnAt = time.Time{}
	return true, nil
}

func (f *fakeWithdrawalStore) PurgeAccountDependents(
	context.Context,
	platform.UserScope,
) error {
	f.dependentCalls++
	appendWithdrawalEvent(f.events, "account_dependents")
	return f.dependentsErr
}

func (f *fakeWithdrawalStore) PurgeAccountUser(
	context.Context,
	platform.UserScope,
) (bool, error) {
	f.userCalls++
	appendWithdrawalEvent(f.events, "account_user")
	if f.userErr != nil {
		return false, f.userErr
	}
	if !f.found {
		return false, nil
	}
	f.found = false
	f.withdrawnAt = time.Time{}
	return true, nil
}

type fakeWithdrawalScheduler struct {
	scheduled   []time.Time
	cancels     int
	scheduleErr error
	cancelErr   error
}

func (f *fakeWithdrawalScheduler) Schedule(
	_ context.Context,
	_ platform.UserScope,
	dueAt time.Time,
) error {
	f.scheduled = append(f.scheduled, dueAt)
	return f.scheduleErr
}

func (f *fakeWithdrawalScheduler) Cancel(context.Context, platform.UserScope) error {
	f.cancels++
	return f.cancelErr
}

type fakeUserDataPurger struct {
	name   string
	err    error
	events *[]string
}

func (f *fakeUserDataPurger) PurgeName() string { return f.name }

func (f *fakeUserDataPurger) PurgeUser(context.Context, platform.UserScope) error {
	appendWithdrawalEvent(f.events, f.name)
	return f.err
}

type fakeCredentialDirectory struct {
	errAt  string
	events *[]string
}

func (f *fakeCredentialDirectory) SetUserBanned(
	_ context.Context,
	_ string,
	banned bool,
) error {
	if banned {
		appendWithdrawalEvent(f.events, "credential_ban")
	}
	if f.errAt == "ban" {
		return errors.New("ban failed")
	}
	return nil
}

func (f *fakeCredentialDirectory) DeleteUser(context.Context, string) error {
	appendWithdrawalEvent(f.events, "credential_delete")
	if f.errAt == "delete" {
		return errors.New("delete failed")
	}
	return nil
}

func appendWithdrawalEvent(events *[]string, event string) {
	if events != nil {
		*events = append(*events, event)
	}
}

func newWithdrawalTestService(
	t *testing.T,
	store *fakeWithdrawalStore,
	scheduler *fakeWithdrawalScheduler,
	purgers []UserDataPurger,
	credentials *fakeCredentialDirectory,
	now time.Time,
) *Service {
	t.Helper()
	service, err := NewService(ServiceDeps{
		Store:              &fakeStore{},
		Directory:          &fakeDirectory{},
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
		Achievements:       NoAchievementRecorder{},
		Withdrawals:        store,
		Scheduler:          scheduler,
		Purgers:            purgers,
		Credentials:        credentials,
		Now:                func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func TestWithdrawPairsOneDeadlineAndPreservesOriginalWindow(t *testing.T) {
	now := time.Date(2026, 7, 26, 1, 2, 3, 456000000, time.FixedZone("KST", 9*60*60))
	store := &fakeWithdrawalStore{found: true}
	scheduler := &fakeWithdrawalScheduler{}
	service := newWithdrawalTestService(
		t,
		store,
		scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		now,
	)
	scope := mustScope(t, "withdraw-user")

	first, err := service.Withdraw(context.Background(), scope)
	if err != nil {
		t.Fatalf("Withdraw(first) failed: %v", err)
	}
	service.now = func() time.Time { return now.Add(12 * time.Hour) }
	second, err := service.Withdraw(context.Background(), scope)
	if err != nil {
		t.Fatalf("Withdraw(second) failed: %v", err)
	}

	retention := values.AccountWithdrawalRetentionWindow()
	wantAt := now.UTC()
	if !first.WithdrawnAt.Equal(wantAt) ||
		!first.RestoreDeadlineAt.Equal(wantAt.Add(retention)) ||
		first != second {
		t.Fatalf("windows = first %#v second %#v, want original UTC window", first, second)
	}
	if len(scheduler.scheduled) != 2 {
		t.Fatalf("schedule attempts = %d, want two idempotent dedup attempts", len(scheduler.scheduled))
	}
	if !scheduler.scheduled[0].Equal(wantAt.Add(retention)) {
		t.Fatalf("first due = %v, want %v", scheduler.scheduled[0], wantAt.Add(retention))
	}
}

func TestWithdrawScheduleFailureCannotMarkAccount(t *testing.T) {
	store := &fakeWithdrawalStore{found: true}
	scheduler := &fakeWithdrawalScheduler{scheduleErr: errors.New("queue unavailable")}
	service := newWithdrawalTestService(
		t,
		store,
		scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		time.Now(),
	)
	if _, err := service.Withdraw(context.Background(), mustScope(t, "withdraw-user")); err == nil {
		t.Fatal("Withdraw error = nil, want scheduler failure")
	}
	if !store.withdrawnAt.IsZero() {
		t.Fatalf("withdrawnAt = %v, want no mark after enqueue failure", store.withdrawnAt)
	}
}

func TestWithdrawWithoutProfileDoesNotScheduleSweep(t *testing.T) {
	store := &fakeWithdrawalStore{}
	scheduler := &fakeWithdrawalScheduler{}
	service := newWithdrawalTestService(
		t,
		store,
		scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		time.Now(),
	)

	if _, err := service.Withdraw(
		context.Background(),
		mustScope(t, "unprovisioned-user"),
	); !errors.Is(err, ErrSignupRequired) {
		t.Fatalf("Withdraw error = %v, want ErrSignupRequired", err)
	}
	if len(scheduler.scheduled) != 0 {
		t.Fatalf("scheduled jobs = %d, want zero", len(scheduler.scheduled))
	}
}

func TestWithdrawCrashAfterScheduleLeavesAnInertSweep(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	store := &fakeWithdrawalStore{
		found:   true,
		markErr: errors.New("mark failed"),
	}
	scheduler := &fakeWithdrawalScheduler{}
	service := newWithdrawalTestService(
		t,
		store,
		scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		now,
	)
	scope := mustScope(t, "withdraw-user")
	if _, err := service.Withdraw(context.Background(), scope); err == nil {
		t.Fatal("Withdraw error = nil, want mark failure")
	}
	if len(scheduler.scheduled) != 1 || !store.withdrawnAt.IsZero() {
		t.Fatalf(
			"crash state = scheduled %d withdrawn %v, want durable job without marker",
			len(scheduler.scheduled),
			store.withdrawnAt,
		)
	}
	store.markErr = nil
	if err := service.SweepWithdrawnAccount(
		context.Background(),
		scope,
		now.Add(31*24*time.Hour),
	); err != nil {
		t.Fatalf("orphan sweep failed: %v", err)
	}
	if store.userCalls != 0 {
		t.Fatal("orphan sweep without withdrawn marker purged the user")
	}
}

func TestRestoreAccountRefusalsAndFailedCancelRemainSweepSafe(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	retention := values.AccountWithdrawalRetentionWindow()

	for _, testCase := range []struct {
		name        string
		withdrawnAt time.Time
		wantErr     error
	}{
		{name: "not withdrawn", wantErr: ErrNotWithdrawn},
		{name: "expired", withdrawnAt: now.Add(-retention), wantErr: ErrRestoreWindowExpired},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			store := &fakeWithdrawalStore{found: true, withdrawnAt: testCase.withdrawnAt}
			service := newWithdrawalTestService(
				t,
				store,
				&fakeWithdrawalScheduler{},
				[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
				&fakeCredentialDirectory{},
				now,
			)
			if _, err := service.RestoreAccount(
				context.Background(),
				mustScope(t, "restore-user"),
			); !errors.Is(err, testCase.wantErr) {
				t.Fatalf("RestoreAccount error = %v, want %v", err, testCase.wantErr)
			}
		})
	}

	store := &fakeWithdrawalStore{found: true, withdrawnAt: now.Add(-time.Hour)}
	scheduler := &fakeWithdrawalScheduler{cancelErr: errors.New("cancel failed")}
	service := newWithdrawalTestService(
		t,
		store,
		scheduler,
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		now,
	)
	scope := mustScope(t, "restore-user")
	if _, err := service.RestoreAccount(context.Background(), scope); err == nil {
		t.Fatal("RestoreAccount error = nil, want cancellation failure")
	}
	if !store.withdrawnAt.IsZero() {
		t.Fatal("RestoreAccount must commit the live marker before cancellation")
	}
	if err := service.SweepWithdrawnAccount(context.Background(), scope, now.Add(retention)); err != nil {
		t.Fatalf("stale sweep failed: %v", err)
	}
	if store.userCalls != 0 {
		t.Fatal("stale sweep after restore must not purge the user")
	}
}

func TestWithdrawnStatusCacheAvoidsRepeatedReadsAndInvalidatesOnRestore(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	store := &fakeWithdrawalStore{found: true, withdrawnAt: now.Add(-time.Hour)}
	service := newWithdrawalTestService(
		t,
		store,
		&fakeWithdrawalScheduler{},
		[]UserDataPurger{&fakeUserDataPurger{name: "memory"}},
		&fakeCredentialDirectory{},
		now,
	)
	scope := mustScope(t, "restore-user")

	for range 2 {
		withdrawnAt, withdrawn, err := service.WithdrawnAt(context.Background(), scope.UserID())
		if err != nil || !withdrawn || !withdrawnAt.Equal(store.withdrawnAt) {
			t.Fatalf("WithdrawnAt = (%v, %v, %v)", withdrawnAt, withdrawn, err)
		}
	}
	if store.statusCalls != 1 {
		t.Fatalf("status reads before restore = %d, want one", store.statusCalls)
	}

	if _, err := service.RestoreAccount(context.Background(), scope); err != nil {
		t.Fatalf("RestoreAccount failed: %v", err)
	}
	if _, withdrawn, err := service.WithdrawnAt(context.Background(), scope.UserID()); err != nil || withdrawn {
		t.Fatalf("WithdrawnAt after restore = withdrawn %v err %v, want live", withdrawn, err)
	}
	if store.statusCalls != 2 {
		t.Fatalf("status reads after restore = %d, want cache miss read", store.statusCalls)
	}
}

func TestWithdrawalStatusCacheIsBoundedAndMutationFencesOldMisses(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	cache := withdrawalStatusCache{}

	_, _, _, oldGeneration := cache.read("racing-user", now)
	cache.invalidate("racing-user")
	if cache.writeIfCurrent("racing-user", now, true, now, oldGeneration) {
		t.Fatal("status read that began before invalidation repopulated the cache")
	}

	for index := range withdrawalStatusCacheMaxEntries + 1 {
		cache.replace(fmt.Sprintf("user-%d", index), time.Time{}, false, now)
	}
	if len(cache.entries) != withdrawalStatusCacheMaxEntries {
		t.Fatalf(
			"cache entries = %d, want bounded at %d",
			len(cache.entries),
			withdrawalStatusCacheMaxEntries,
		)
	}
	if _, exists := cache.entries["user-0"]; exists {
		t.Fatal("least-recently-used cache entry was not evicted")
	}
}

func TestWithdrawalSweepRechecksDeadlineAndOrdersCompletionMarkerLast(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	retention := values.AccountWithdrawalRetentionWindow()
	events := []string{}
	store := &fakeWithdrawalStore{
		found:       true,
		withdrawnAt: now,
		events:      &events,
	}
	service := newWithdrawalTestService(
		t,
		store,
		&fakeWithdrawalScheduler{},
		[]UserDataPurger{
			&fakeUserDataPurger{name: "memory", events: &events},
			&fakeUserDataPurger{name: "twinkle", events: &events},
		},
		&fakeCredentialDirectory{events: &events},
		now,
	)
	scope := mustScope(t, "sweep-user")

	err := service.SweepWithdrawnAccount(context.Background(), scope, now.Add(retention-time.Second))
	var retryAt interface{ RetryAt() time.Time }
	if !errors.As(err, &retryAt) || !retryAt.RetryAt().Equal(now.Add(retention)) {
		t.Fatalf("early sweep error = %v, want RetryAt(%v)", err, now.Add(retention))
	}
	if len(events) != 0 {
		t.Fatalf("early sweep events = %v, want none", events)
	}

	if err := service.SweepWithdrawnAccount(context.Background(), scope, now.Add(retention)); err != nil {
		t.Fatalf("due sweep failed: %v", err)
	}
	want := []string{
		"memory",
		"twinkle",
		"account_dependents",
		"credential_ban",
		"credential_delete",
		"account_user",
	}
	if !reflect.DeepEqual(events, want) {
		t.Fatalf("sweep order = %v, want %v", events, want)
	}
	if err := service.SweepWithdrawnAccount(context.Background(), scope, now.Add(retention)); err != nil {
		t.Fatalf("replayed sweep failed: %v", err)
	}
	if !reflect.DeepEqual(events, want) {
		t.Fatalf("replay added effects: %v", events)
	}
}

func TestWithdrawalSweepReplaysSafelyAfterEveryLegFailure(t *testing.T) {
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	retention := values.AccountWithdrawalRetentionWindow()
	for _, failure := range []string{"memory", "twinkle", "dependents", "ban", "delete", "user"} {
		t.Run(failure, func(t *testing.T) {
			events := []string{}
			store := &fakeWithdrawalStore{
				found:       true,
				withdrawnAt: now,
				events:      &events,
			}
			memoryPurger := &fakeUserDataPurger{name: "memory", events: &events}
			twinklePurger := &fakeUserDataPurger{name: "twinkle", events: &events}
			credentials := &fakeCredentialDirectory{events: &events}
			switch failure {
			case "memory":
				memoryPurger.err = errors.New("memory failed")
			case "twinkle":
				twinklePurger.err = errors.New("twinkle failed")
			case "dependents":
				store.dependentsErr = errors.New("dependents failed")
			case "ban", "delete":
				credentials.errAt = failure
			case "user":
				store.userErr = errors.New("user failed")
			}
			service := newWithdrawalTestService(
				t,
				store,
				&fakeWithdrawalScheduler{},
				[]UserDataPurger{memoryPurger, twinklePurger},
				credentials,
				now,
			)
			scope := mustScope(t, "replay-user")
			if err := service.SweepWithdrawnAccount(
				context.Background(),
				scope,
				now.Add(retention),
			); err == nil {
				t.Fatal("first sweep error = nil, want injected failure")
			}
			if !store.found {
				t.Fatal("completion marker was deleted before all legs succeeded")
			}

			memoryPurger.err = nil
			twinklePurger.err = nil
			store.dependentsErr = nil
			store.userErr = nil
			credentials.errAt = ""
			if err := service.SweepWithdrawnAccount(
				context.Background(),
				scope,
				now.Add(retention),
			); err != nil {
				t.Fatalf("replayed sweep failed: %v", err)
			}
			if store.found || len(events) == 0 || events[len(events)-1] != "account_user" {
				t.Fatalf("replayed completion = found %v events %v", store.found, events)
			}
		})
	}
}

func TestNewServiceRejectsIncompleteWithdrawalBundle(t *testing.T) {
	base := ServiceDeps{
		Store:              &fakeStore{},
		Directory:          &fakeDirectory{},
		InviteGranter:      &fakeInviteGranter{},
		SignupBonusGranter: &fakeSignupBonusGranter{},
		Achievements:       NoAchievementRecorder{},
	}
	store := &fakeWithdrawalStore{}
	scheduler := &fakeWithdrawalScheduler{}
	credentials := &fakeCredentialDirectory{}
	purger := &fakeUserDataPurger{name: "memory"}

	for _, testCase := range []struct {
		name    string
		mutate  func(*ServiceDeps)
		wantErr error
	}{
		{
			name: "missing scheduler",
			mutate: func(deps *ServiceDeps) {
				deps.Withdrawals, deps.Credentials, deps.Purgers = store, credentials, []UserDataPurger{purger}
			},
			wantErr: ErrWithdrawalSchedulerRequired,
		},
		{
			name: "missing credentials",
			mutate: func(deps *ServiceDeps) {
				deps.Withdrawals, deps.Scheduler, deps.Purgers = store, scheduler, []UserDataPurger{purger}
			},
			wantErr: ErrCredentialDirectoryRequired,
		},
		{
			name: "empty purgers",
			mutate: func(deps *ServiceDeps) {
				deps.Withdrawals, deps.Scheduler, deps.Credentials = store, scheduler, credentials
			},
			wantErr: ErrPurgersRequired,
		},
		{
			name: "duplicate purgers",
			mutate: func(deps *ServiceDeps) {
				deps.Withdrawals, deps.Scheduler, deps.Credentials = store, scheduler, credentials
				deps.Purgers = []UserDataPurger{purger, &fakeUserDataPurger{name: "memory"}}
			},
			wantErr: ErrDuplicatePurger,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			deps := base
			testCase.mutate(&deps)
			if _, err := NewService(deps); !errors.Is(err, testCase.wantErr) {
				t.Fatalf("NewService error = %v, want %v", err, testCase.wantErr)
			}
		})
	}
}
