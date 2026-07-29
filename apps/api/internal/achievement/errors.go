package achievement

import "errors"

var (
	// ErrScopeRequired mirrors the transport guard: every read and every write is scoped to an
	// authenticated user ([U1]).
	ErrScopeRequired = errors.New("achievement requires an authenticated user scope")
	// ErrRepoRequired is a wiring fault — the service was built without the repository it reads.
	ErrRepoRequired = errors.New("achievement service requires its repository")
	// ErrUnknownCounterKey refuses a key outside the closed vocabulary. Always a wiring fault,
	// never user input: it fails the producing transaction, which is safe because the
	// composition-root membership test makes a typo'd producer constant a test failure first.
	ErrUnknownCounterKey = errors.New("achievement does not define this counter key")
	// ErrNonPositiveDelta is the monotonicity guard ([I1][A1]): no decrement path exists, so
	// letting go, releasing a diary or un-selecting an ornament can never lower a counter.
	ErrNonPositiveDelta = errors.New("achievement counters only move forward")
	// ErrCounterModeMismatch refuses a write whose statement does not match the key's declared
	// mode. It is what makes "the mode lives in the definition, never at the call site" structural:
	// adding to a reach counter would turn 단계 도달 into a count, so four stage-1 views could
	// unlock the stage-4 row.
	ErrCounterModeMismatch = errors.New("achievement counter was written in the wrong mode")
	// ErrUnknownAchievementID refuses a progress write for an id the catalog does not publish. A
	// typo would otherwise leave a durable row no read can ever answer for.
	ErrUnknownAchievementID = errors.New("achievement does not publish this achievement id")
	// ErrClaimIDRequired refuses an empty claim id. The DDL CHECK only pairs claimed_at with
	// claim_id, and an empty string satisfies it — but it is the dedup key both reward legs carry,
	// so an empty one would collapse every claim into a single dedup identity.
	ErrClaimIDRequired = errors.New("achievement claim requires a claim id")
)
