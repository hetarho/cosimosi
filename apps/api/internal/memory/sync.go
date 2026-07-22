package memory

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// SyncResult is the advance interval a sync crossed: the clock before (nil =
// the unborn clock) and after. Callers animate/replay over it.
type SyncResult struct {
	Previous *time.Time
	Current  time.Time
}

// SyncToToday advances the universe clock to today ([T2] case 2) — the
// capability the recall use-case composes behind the sync-consent gate
// ([R1a]). It is deliberately not an RPC and has no button: recall is its only
// caller. Idempotent within a day (the GREATEST upsert holds today), it
// mutates no Diary ([I2]) and fires the progression hook over the crossed
// interval inside the same transaction, exactly like the launch advance ([T4]).
func (s *Service) SyncToToday(ctx context.Context, scope platform.UserScope) (SyncResult, error) {
	if scope.UserID() == "" {
		return SyncResult{}, ErrScopeRequired
	}
	var result SyncResult
	err := s.launches.InLaunchTx(ctx, func(tx LaunchTx) error {
		// The standalone sync IS the explicit consent action, so it advances unconditionally.
		r, err := s.syncToToday(ctx, scope, tx, true)
		if err != nil {
			return err
		}
		result = r
		return nil
	})
	if err != nil {
		return SyncResult{}, err
	}
	return result, nil
}

// SyncStatus is the server-authoritative sync-status read ([R1a], A1): the UTC "today" a
// recall/whole-diary recall would sync to and whether the clock currently lags it, computed from
// the same guard baseline (clock, or the latest launched memory while the clock is unborn) and the
// same UTC `now` the recall sync uses — so the client drives the consent decision from the server
// clock, never a local Date. A pure read: no lock, no advance, no Twinkle.
func (s *Service) SyncStatus(ctx context.Context, scope platform.UserScope) (SyncStatus, error) {
	if scope.UserID() == "" {
		return SyncStatus{}, ErrScopeRequired
	}
	guard, err := s.signals.UniverseClock(ctx, scope)
	if err != nil {
		return SyncStatus{}, err
	}
	if guard == nil {
		guard, err = s.signals.LatestLaunchedUniverseTime(ctx, scope)
		if err != nil {
			return SyncStatus{}, err
		}
	}
	today := utcDate(s.now())
	return SyncStatus{Today: today, NeedsSync: syncNeedsConsent(guard, today)}, nil
}

// SyncStatus is the read's result: the server's UTC "today" (the sync target) and whether a sync
// would advance the clock (needs consent, [R1a]).
type SyncStatus struct {
	Today     time.Time
	NeedsSync bool
}

// syncNeedsConsent is the shared server-authoritative consent rule: advancing the clock to today
// moves it forward iff the clock is born and today is strictly after it. An unborn clock needs no
// consent (there is no memory to recall yet, and a birth is not a forward-forgetting jump). Both
// SyncStatus and the recall sync gate decide from this one rule ([R1a]).
func syncNeedsConsent(guard *time.Time, today time.Time) bool {
	return guard != nil && today.After(utcDate(*guard))
}

// syncToToday advances the clock to today on an already-open transaction and
// returns the crossed interval. Factored out of SyncToToday so the recall
// use-case composes the same advance INSIDE its own transaction ([R1a]) — recall
// and sync must land atomically, so recall cannot call SyncToToday (which opens
// its own transaction). The surface is ProgressionTx: sync touches only the clock
// and the progression hook, never a launch write. LaunchTx and RecallTx both
// satisfy it.
func (s *Service) syncToToday(ctx context.Context, scope platform.UserScope, tx ProgressionTx, consent bool) (SyncResult, error) {
	// Serialize against concurrent launches for the whole transaction,
	// birth window included, exactly as the launch path does ([I10]).
	if err := tx.LockGraphMutation(ctx, scope); err != nil {
		return SyncResult{}, err
	}
	clock, err := tx.UniverseClockForUpdate(ctx, scope)
	if err != nil {
		return SyncResult{}, err
	}
	// Mirror the launch guard's unborn-clock fallback: a pre-clock universe
	// shows the latest launched memory as its universe time, so a sync must
	// advance from that baseline — never birth the clock at today when today
	// is before it, which would visibly rewind the observable present.
	guard := clock
	if guard == nil {
		guard, err = tx.LatestLaunchedUniverseTime(ctx, scope)
		if err != nil {
			return SyncResult{}, err
		}
	}
	// Server-enforced consent gate ([R1a], A1/A5): if advancing to today would move the clock
	// forward, the caller must have consented — decided from the SERVER clock, never a client
	// Date. Refused before any spend/effect, so nothing is charged and the client can safely
	// re-consent (the recall's operation id stays reusable — no receipt was written).
	today := utcDate(s.now())
	if !consent && syncNeedsConsent(guard, today) {
		return SyncResult{}, ErrSyncConsentRequired
	}
	var current *time.Time
	if err := s.advanceAndProgress(ctx, scope, tx, guard, AdvanceClock(timeOrZero(guard), today), &current); err != nil {
		return SyncResult{}, err
	}
	return SyncResult{Previous: guard, Current: *current}, nil
}

// advanceAndProgress moves the clock to target and fires the progression hook
// only when the clock actually moved: a held clock (same-day sync, equal-date
// launch) crosses no interval, so no advance-triggered work may be implied —
// otherwise every idempotent re-sync would re-fire the interval's handlers.
func (s *Service) advanceAndProgress(ctx context.Context, scope platform.UserScope, tx ProgressionTx, from *time.Time, target time.Time, out **time.Time) error {
	advanced, err := tx.AdvanceUniverseClock(ctx, scope, target)
	if err != nil {
		return err
	}
	if out != nil {
		*out = &advanced
	}
	if from != nil && !advanced.After(*from) {
		return nil
	}
	return s.progression.OnAdvance(ctx, scope, tx, from, advanced)
}

func timeOrZero(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return *value
}

// NoopAdvanceProgression is the shipped AdvanceProgression default: forgetting
// is read-time (the next read simply sees a later "now"), so an advance implies
// no work yet. The consolidation/semanticize progression handlers replace this
// binding once the advance-triggered writes they own exist.
type NoopAdvanceProgression struct{}

func (NoopAdvanceProgression) OnAdvance(context.Context, platform.UserScope, ProgressionTx, *time.Time, time.Time) error {
	return nil
}
