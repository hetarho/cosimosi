package memory

import (
	"testing"
	"time"
)

func TestAdvanceClockIsMonotonic(t *testing.T) {
	t.Parallel()

	earlier := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	later := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)

	if got := AdvanceClock(earlier, later); !got.Equal(later) {
		t.Fatalf("AdvanceClock(earlier, later) = %v, want %v", got, later)
	}
	if got := AdvanceClock(later, earlier); !got.Equal(later) {
		t.Fatalf("AdvanceClock(later, earlier) = %v, want the clock unchanged at %v", got, later)
	}
	if got := AdvanceClock(later, later); !got.Equal(later) {
		t.Fatalf("AdvanceClock(later, later) = %v, want %v", got, later)
	}
}

func TestAdvanceClockNeverReturnsEarlierThanCurrent(t *testing.T) {
	t.Parallel()

	current := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)
	targets := []time.Time{
		{},
		time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC),
		current.AddDate(0, 0, -1),
		current,
		current.AddDate(0, 0, 1),
		current.AddDate(3, 0, 0),
	}
	for _, target := range targets {
		if got := AdvanceClock(current, target); got.Before(current) {
			t.Fatalf("AdvanceClock(%v, %v) = %v, went backward", current, target, got)
		}
	}
}

func TestAdvanceClockBirthLandsOnTargetDay(t *testing.T) {
	t.Parallel()

	// The unborn clock is the zero time; the first advance must land on the target's
	// day, truncating any time-of-day component to the DATE granularity of the model.
	target := time.Date(2026, 7, 8, 13, 45, 12, 0, time.UTC)
	want := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)
	if got := AdvanceClock(time.Time{}, target); !got.Equal(want) {
		t.Fatalf("AdvanceClock(zero, %v) = %v, want %v", target, got, want)
	}
}

func TestCanLaunchAtBoundaries(t *testing.T) {
	t.Parallel()

	clock := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)

	if !CanLaunchAt(clock.AddDate(0, 0, 1), &clock) {
		t.Fatal("CanLaunchAt(after, clock) = false, want launch")
	}
	if !CanLaunchAt(clock, &clock) {
		t.Fatal("CanLaunchAt(equal, clock) = false, want launch")
	}
	if CanLaunchAt(clock.AddDate(0, 0, -1), &clock) {
		t.Fatal("CanLaunchAt(before, clock) = true, want the past-dated diary refused")
	}
}

func TestCanLaunchAtNilClockAlwaysLaunches(t *testing.T) {
	t.Parallel()

	anyDate := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	if !CanLaunchAt(anyDate, nil) {
		t.Fatal("CanLaunchAt(date, nil) = false, want launch on the unborn clock")
	}
}

func TestCanLaunchAtComparesAtDayGranularity(t *testing.T) {
	t.Parallel()

	// A same-day diary with a time-of-day component must not read as "before" the
	// midnight-normalized clock — universe time is a DATE, not an instant.
	clock := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)
	sameDayLater := time.Date(2026, 7, 8, 23, 59, 0, 0, time.UTC)
	if !CanLaunchAt(sameDayLater, &clock) {
		t.Fatal("CanLaunchAt(same day with time, clock) = false, want launch")
	}
}
