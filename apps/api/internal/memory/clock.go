package memory

import "time"

// The universe clock is the per-user, diary-driven "now" of the whole engine ([T5]): a
// single DATE on the diary timeline, day granularity, matching every other universe-time
// column. Read-time derivations (forgetting decay, the semanticize timer, synapse strength
// decay) consume it as a scalar elapsed-days reference; it is never a position/coordinate
// and has no path into layout ([I7]).
//
// Birth: a user with no launches has no universe_state row and reads a nil universe time
// (the empty universe). The row is created lazily by the first advance — an upsert keyed
// by user_id (memory/pg). Orchestrating *when* to advance (launch → diary date, recall →
// today) is the time-advance use-case's; this model owns only the rules.
//
// Dates are UTC-day values throughout: diary dates enter as time.DateOnly strings parsed
// in UTC and DATE columns read back as UTC midnights, so the truncation here never shifts
// a caller's calendar day. A local-zone timestamp is not a valid universe-time input.

// AdvanceClock returns the monotonic advance of the clock: the later of current and
// target, at day granularity. The clock never decreases by construction ([I10]) — there
// is no operation that moves it backward. A zero current stands for the unborn clock, so
// the first advance lands on the target date.
func AdvanceClock(current, target time.Time) time.Time {
	currentDay := utcDate(current)
	targetDay := utcDate(target)
	if targetDay.After(currentDay) {
		return targetDay
	}
	return currentDay
}

// CanLaunchAt is the diary-date monotonic constraint ([T1]): a diary dated on/after the
// current clock launches its memories (and the clock advances to that date); a diary dated
// before the clock is saved but launches nothing. A nil clock (no launches yet) always
// permits the launch. Enforcing this at launch is the use-case's transaction; this
// predicate is the rule.
func CanLaunchAt(diaryDate time.Time, clock *time.Time) bool {
	if clock == nil {
		return true
	}
	return !utcDate(diaryDate).Before(utcDate(*clock))
}
