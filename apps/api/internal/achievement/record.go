package achievement

import (
	"context"
	"fmt"

	"github.com/cosimosi/api/internal/platform"
)

// RecordProgress is the write half of the context: a producing context reports (key, delta) from
// inside the transaction that made the fact true, and this composes the counter write and the
// achieved marks over that same transaction.
//
// `store` arrives ALREADY BOUND to the caller's transaction (the shape twinkle's CheckAndSpend uses),
// which is what makes "a rolled-back launch advances no counter" structural rather than a promise:
// there is no path here that opens a transaction of its own.
//
// Evaluation is `counter >= target` over two integers with **no time input**, and the service holds
// no clock — so a streak has nothing to read even if someone wrote the row.
func (s *Service) RecordProgress(
	ctx context.Context,
	scope platform.UserScope,
	store Store,
	counterKey CounterKey,
	delta int,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if store == nil {
		return ErrRepoRequired
	}
	mode, known := CounterModeOf(counterKey)
	if !known {
		return fmt.Errorf("%w: %s", ErrUnknownCounterKey, counterKey)
	}
	// The mode decides what a valid report is, so it has to be resolved FIRST: an accumulate report
	// of zero is a caller with nothing to add, but a reach report of zero is a fact a producer can
	// legitimately observe (a user owning no ornaments yet), and GREATEST(value, 0) lowers nothing.
	// Refusing it here would abort the save that reported it.
	if !reportable(mode, int64(delta)) {
		return fmt.Errorf("%w: %s in %s mode got %d", ErrProgressDeltaInvalid, counterKey, mode, delta)
	}
	// A producer may not push a counter this context derives for itself: distinctness is a property
	// only the table's owner can prove, and thirteen JOY entries would otherwise read as thirteen
	// moods.
	if DerivedCounterKey(counterKey) {
		return fmt.Errorf("%w: %s", ErrDerivedCounterNotReportable, counterKey)
	}

	// The insert's affected-row count IS first touch, and it is the whole reason the variety counters
	// need no DISTINCT query, no xmax and no second condition kind.
	created, err := store.TouchCounter(ctx, scope, counterKey)
	if err != nil {
		return fmt.Errorf("touch counter %s: %w", counterKey, err)
	}
	if created {
		if err := s.bumpVariety(ctx, scope, store, counterKey); err != nil {
			return err
		}
	}

	value, err := s.writeCounter(ctx, scope, store, counterKey, mode, int64(delta))
	if err != nil {
		return err
	}
	return s.markReached(ctx, scope, store, counterKey, value)
}

// reportable applies the MODE's own rule for what a valid report is, so the service and the store
// agree instead of the stricter one silently winning and aborting a legitimate save.
func reportable(mode CounterMode, amount int64) bool {
	if mode == CounterModeReach {
		return RequireReachLevel(amount) == nil
	}
	return RequireForwardDelta(amount) == nil
}

// bumpVariety raises the family's variety counter by one on the first touch of a member. It runs in
// the caller's transaction, so the member row and the variety it implies commit together.
func (s *Service) bumpVariety(
	ctx context.Context,
	scope platform.UserScope,
	store Store,
	counterKey CounterKey,
) error {
	variety, isFamilyMember := VarietyCounterFor(counterKey)
	if !isFamilyMember {
		return nil
	}
	if _, err := store.TouchCounter(ctx, scope, variety); err != nil {
		return fmt.Errorf("touch variety counter %s: %w", variety, err)
	}
	value, err := store.AddCounter(ctx, scope, variety, 1)
	if err != nil {
		return fmt.Errorf("bump variety counter %s: %w", variety, err)
	}
	return s.markReached(ctx, scope, store, variety, value)
}

// writeCounter dispatches on the key's DECLARED mode, never on anything the caller said: accumulate
// sums, reach keeps the high-water mark. A producer has no argument in which to choose.
func (s *Service) writeCounter(
	ctx context.Context,
	scope platform.UserScope,
	store Store,
	counterKey CounterKey,
	mode CounterMode,
	delta int64,
) (int64, error) {
	switch mode {
	case CounterModeReach:
		value, err := store.RaiseCounter(ctx, scope, counterKey, delta)
		if err != nil {
			return 0, fmt.Errorf("raise counter %s: %w", counterKey, err)
		}
		return value, nil
	case CounterModeAccumulate:
		value, err := store.AddCounter(ctx, scope, counterKey, delta)
		if err != nil {
			return 0, fmt.Errorf("add counter %s: %w", counterKey, err)
		}
		return value, nil
	default:
		return 0, fmt.Errorf("%w: %s has mode %q", ErrUnknownCounterKey, counterKey, mode)
	}
}

// markReached marks every catalog row on this counter whose target the new value meets. The insert is
// ON CONFLICT DO NOTHING, so achieved_at is stamped by Postgres exactly once and re-crossing a
// threshold changes nothing ([I1]).
//
// A per-candidate loop rather than a batch: the candidates are one axis's tiers, a handful, and every
// statement stays plain sqlc inside the isolation gate's supported grammar with user_id as a
// parameter ([U1]).
func (s *Service) markReached(
	ctx context.Context,
	scope platform.UserScope,
	store Store,
	counterKey CounterKey,
	value int64,
) error {
	for _, row := range AchievementsByCounter(counterKey) {
		if !Achieved(value, row.Condition.Target) {
			continue
		}
		if _, err := store.MarkAchieved(ctx, scope, row.ID); err != nil {
			return fmt.Errorf("mark %s achieved: %w", row.ID, err)
		}
	}
	return nil
}
