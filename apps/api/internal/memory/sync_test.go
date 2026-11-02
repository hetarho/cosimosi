package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Fixture "now" is 2026-07-02T12:00Z, so today at day granularity is 2026-07-02.
func fixtureToday() time.Time {
	return time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
}

type fixedUserZone struct {
	location *time.Location
}

func (f fixedUserZone) ZoneFor(context.Context, platform.UserScope) (*time.Location, error) {
	return f.location, nil
}

func TestRealClockDayBoundariesUseTheUsersZoneAtAllFourSites(t *testing.T) {
	t.Parallel()
	seoul, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		t.Fatalf("LoadLocation failed: %v", err)
	}
	now := time.Date(2026, 7, 1, 15, 0, 0, 0, time.UTC)
	seoulToday := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)

	launchFixture := newFixture(t)
	launchFixture.launch.now = func() time.Time { return now }
	launchFixture.launch.userZone = fixedUserZone{location: seoul}
	if _, err := launchFixture.launch.PersistEncoded(context.Background(), testScope(t), testDiaryBody, seoulToday, confirmedFixture()); err != nil {
		t.Fatalf("launch rejected the user's current day: %v", err)
	}

	statusFixture := newFixture(t)
	statusFixture.reads.now = func() time.Time { return now }
	statusFixture.reads.userZone = fixedUserZone{location: seoul}
	statusFixture.launch.now = func() time.Time { return now }
	statusFixture.launch.userZone = fixedUserZone{location: seoul}
	status, err := statusFixture.reads.SyncStatus(context.Background(), testScope(t))
	if err != nil || !status.Today.Equal(seoulToday) {
		t.Fatalf("SyncStatus = %#v, %v; want Seoul today %v", status, err, seoulToday)
	}
	synced, err := statusFixture.launch.SyncToToday(context.Background(), testScope(t))
	if err != nil || !synced.Current.Equal(seoulToday) {
		t.Fatalf("SyncToToday = %#v, %v; want Seoul today %v", synced, err, seoulToday)
	}

	signalFixture := newFixture(t)
	signalFixture.signals.now = func() time.Time { return now }
	signalFixture.signals.userZone = fixedUserZone{location: seoul}
	signalToday, err := signalFixture.signals.signalUniverseTime(context.Background(), testScope(t))
	if err != nil || !signalToday.Equal(seoulToday) {
		t.Fatalf("signalUniverseTime = %v, %v; want Seoul today %v", signalToday, err, seoulToday)
	}
}

func TestUTCUserZoneIsTheDefaultBinding(t *testing.T) {
	t.Parallel()
	location, err := (UTCUserZone{}).ZoneFor(context.Background(), testScope(t))
	if err != nil || location != time.UTC {
		t.Fatalf("UTCUserZone = %v, %v", location, err)
	}
}

func TestSyncToTodayAdvancesClockAndReturnsInterval(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &previous

	result, err := fixture.launch.SyncToToday(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}
	if result.Previous == nil || !result.Previous.Equal(previous) {
		t.Fatalf("previous = %v, want %v", result.Previous, previous)
	}
	if !result.Current.Equal(fixtureToday()) {
		t.Fatalf("current = %v, want today %v", result.Current, fixtureToday())
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(fixtureToday()) {
		t.Fatalf("committed clock = %v, want today", fixture.launches.clock)
	}
	if len(fixture.progression.calls) != 1 {
		t.Fatalf("progression calls = %d, want 1", len(fixture.progression.calls))
	}
	call := fixture.progression.calls[0]
	if call.from == nil || !call.from.Equal(previous) || !call.to.Equal(fixtureToday()) || !call.insideTx {
		t.Fatalf("hook = %+v, want the {previous, today} interval inside the transaction", call)
	}
	// A sync writes no Diary and launches nothing ([I2]).
	state := fixture.launches.committed
	if len(state.diaries)+len(state.memories)+len(state.neurons)+len(state.jobs) != 0 {
		t.Fatalf("sync wrote launch rows: %+v", state)
	}
}

func TestSyncToTodayIsIdempotentWithinADay(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	today := fixtureToday()
	fixture.launches.clock = &today

	result, err := fixture.launch.SyncToToday(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}
	if result.Previous == nil || !result.Previous.Equal(today) || !result.Current.Equal(today) {
		t.Fatalf("interval = {%v, %v}, want {today, today}", result.Previous, result.Current)
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(today) {
		t.Fatalf("clock = %v, want held at today", fixture.launches.clock)
	}
	// A held clock crosses no interval: the hook must not re-fire on the
	// idempotent same-day re-sync.
	if len(fixture.progression.calls) != 0 {
		t.Fatalf("progression calls = %d, want 0 for a same-day re-sync", len(fixture.progression.calls))
	}
}

func TestSyncToTodayBirthsClockWithNilPrevious(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)

	result, err := fixture.launch.SyncToToday(context.Background(), testScope(t))
	if err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}
	if result.Previous != nil {
		t.Fatalf("previous = %v, want nil for the unborn clock", result.Previous)
	}
	if !result.Current.Equal(fixtureToday()) {
		t.Fatalf("current = %v, want today", result.Current)
	}
}

func TestSyncToTodayRequiresScope(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.launch.SyncToToday(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("missing scope err = %v, want ErrScopeRequired", err)
	}
	if fixture.launches.txCount != 0 {
		t.Fatal("a scope-less sync must be rejected before the transaction")
	}
}

func TestSyncToTodayProgressionFailureRollsBack(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &previous
	fixture.progression.err = errors.New("progression handler failed")

	if _, err := fixture.launch.SyncToToday(context.Background(), testScope(t)); err == nil {
		t.Fatal("a progression failure inside the transaction must fail the sync")
	}
	if fixture.launches.clock == nil || !fixture.launches.clock.Equal(previous) {
		t.Fatalf("clock = %v, want rolled back to %v", fixture.launches.clock, previous)
	}
}

func TestNoopAdvanceProgressionIsANoop(t *testing.T) {
	t.Parallel()
	from := fixtureToday()
	var tx ProgressionTx
	if err := (NoopAdvanceProgression{}).OnAdvance(context.Background(), platform.UserScope{}, tx, &from, fixtureToday()); err != nil {
		t.Fatalf("NoopAdvanceProgression returned %v, want nil", err)
	}
}

func TestCommandsResolveTodayBeforeTheirTransaction(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &previous
	// newFixture's zone reader fails the test when read inside an open transaction.
	if _, err := fixture.launch.SyncToToday(context.Background(), testScope(t)); err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}
}

func TestNewMemoryServicesRefuseMissingUserZone(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := NewLaunchService(LaunchDeps{
		Launches: fixture.launches, Linker: fixture.linker, Progression: fixture.progression,
		SignupSettlement: fixture.signupSettlement,
	}); !errors.Is(err, ErrUserZoneRequired) {
		t.Errorf("NewLaunchService without a zone err = %v, want ErrUserZoneRequired", err)
	}
	if _, err := NewPaidActionService(PaidActionDeps{
		Recalls: fixture.launches, ViewSemantics: fixture.launches, PredictionError: fixture.predictionError,
		Progression: fixture.progression,
	}); !errors.Is(err, ErrUserZoneRequired) {
		t.Errorf("NewPaidActionService without a zone err = %v, want ErrUserZoneRequired", err)
	}
	if _, err := NewReadService(ReadDeps{
		Universe: fixture.universe, Provenance: fixture.provenance, Diaries: fixture.diaries, Clock: fixture.launches,
	}); !errors.Is(err, ErrUserZoneRequired) {
		t.Errorf("NewReadService without a zone err = %v, want ErrUserZoneRequired", err)
	}
	if _, err := NewSpendSignalService(fixture.launches, fixture.gists, nil, nil); !errors.Is(err, ErrUserZoneRequired) {
		t.Errorf("NewSpendSignalService without a zone err = %v, want ErrUserZoneRequired", err)
	}
	if _, err := NewRetentionSweeper(nil); !errors.Is(err, ErrReleasesRequired) {
		t.Errorf("NewRetentionSweeper without a repository err = %v, want ErrReleasesRequired", err)
	}
}

// Persisted job rows name their kind by these strings; renaming one would strand every queued job
// of that kind.
func TestJobRegistrationsPinPersistedKindsAndPolicy(t *testing.T) {
	t.Parallel()
	registrations, err := JobRegistrations(JobDeps{
		Embedder:             &fakeEmbedder{},
		Semanticizer:         &fakeSemanticizer{},
		Sources:              &fakeJobSourceReader{},
		EmbeddingWriter:      &fakeEmbeddingWriter{},
		SemanticStagesWriter: &fakeSemanticStagesWriter{},
		Releases:             newFakeReleaseRepo(),
	})
	if err != nil {
		t.Fatalf("JobRegistrations failed: %v", err)
	}
	want := map[string]bool{"embed": false, "semanticize": false, "consolidate": false, "retention_sweep": true}
	if len(registrations) != len(want) {
		t.Fatalf("registered kinds = %v, want %v", registrations, want)
	}
	for kind, forever := range want {
		registration, ok := registrations[kind]
		if !ok || registration.Handler == nil || registration.RetryForever != forever {
			t.Fatalf("kind %q registration = %+v, want a handler with RetryForever=%v", kind, registration, forever)
		}
	}
}
