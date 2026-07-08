package pg

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// ErrClockTargetRequired rejects an advance with no target date, so the
// consumer-owned use-case can errors.Is() it apart from auth/wiring failures.
var ErrClockTargetRequired = errors.New("universe clock advance requires a target date")

// nilableClock maps the absent universe_state row (the unborn clock — a user
// with no launches yet) to nil, keeping the empty-universe read. Every clock
// read path shares this mapping so "row absent" means one thing.
func nilableClock(row pgtype.Date, err error) (*time.Time, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return datePtr(row), nil
}

// UniverseClock reads the user's authoritative clock (nil = unborn).
func (s Store) UniverseClock(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return nilableClock(s.queries.GetUniverseClock(ctx, scope.UserID()))
}

// UniverseClockForUpdate is the launch guard's read: it locks the clock row for
// the rest of the transaction, so concurrent launches serialize on the guard
// instead of racing it and committing a memory dated before the clock ([I10]).
// An unborn clock has no row to lock; the birth window is guarded by the
// LatestLaunchedUniverseTime baseline instead.
func (s Store) UniverseClockForUpdate(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return nilableClock(s.queries.GetUniverseClockForUpdate(ctx, scope.UserID()))
}

// LatestLaunchedUniverseTime is the guard baseline while the clock row is
// unborn: the newest launched memory's date (nil when the universe is empty).
// It keeps the launch guard consistent with the universe read's fallback, so a
// pre-clock universe cannot birth the clock at a date before its newest memory.
func (s Store) LatestLaunchedUniverseTime(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return nilableClock(s.queries.LatestLaunchedUniverseTime(ctx, scope.UserID()))
}

// AdvanceUniverseClock upserts the clock toward target and returns the
// resulting clock. The use-case computes the advance (memory.AdvanceClock over
// the guarded read); the SQL GREATEST in the upsert guards this write path
// itself, so no caller — including one that skips the domain — can rewind the
// stored value ([I10]).
func (s Store) AdvanceUniverseClock(ctx context.Context, scope platform.UserScope, target time.Time) (time.Time, error) {
	if err := s.ready(scope); err != nil {
		return time.Time{}, err
	}
	if target.IsZero() {
		return time.Time{}, ErrClockTargetRequired
	}
	row, err := s.queries.AdvanceUniverseClock(ctx, dbgen.AdvanceUniverseClockParams{
		UserID:              scope.UserID(),
		CurrentUniverseTime: pgDate(target),
	})
	if err != nil {
		return time.Time{}, err
	}
	return dateValue(row), nil
}
