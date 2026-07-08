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

func TestSyncToTodayAdvancesClockAndReturnsInterval(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	fixture.launches.clock = &previous

	result, err := fixture.service.SyncToToday(context.Background(), testScope(t))
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

	result, err := fixture.service.SyncToToday(context.Background(), testScope(t))
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

	result, err := fixture.service.SyncToToday(context.Background(), testScope(t))
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
	if _, err := fixture.service.SyncToToday(context.Background(), platform.UserScope{}); !errors.Is(err, ErrScopeRequired) {
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

	if _, err := fixture.service.SyncToToday(context.Background(), testScope(t)); err == nil {
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
