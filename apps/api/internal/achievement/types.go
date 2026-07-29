package achievement

import (
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

// Condition is exactly two fields, forever: one counter of the closed vocabulary, and the integer
// it must reach. There is deliberately no time type, no duration, no window, no second counter and
// no comparison operator — a streak, "N per day", "within 7 days" and "counter A while counter B"
// have nowhere to live, and the comparison is fixed at counter >= target ([A1a][A1]).
type Condition struct {
	Counter CounterKey
	Target  int64
}

// RewardTier names which achievement.reward_tier_* values key a stardust reward resolves through.
// The catalog never carries a literal amount, so re-balancing rewards is a values edit; and there
// is no TwinkleKind anywhere in this context, so a SMALL reward is unexpressible rather than
// validated ([A3]).
type RewardTier int

const (
	RewardTierNone RewardTier = iota
	RewardTier1
	RewardTier2
	RewardTier3
)

// Reward is one leg, exactly: a stardust tier, or an ornament id — never both, never neither
// (the catalog self-test's invariant). The ornament id is opaque here: which ornaments exist and
// that these are achievement-only is the store catalog's fact, asserted at the composition root.
type Reward struct {
	Tier       RewardTier
	OrnamentID string
}

// Twinkle is the GENERAL amount this reward pays, resolved from the tier's values key — 0 for an
// ornament reward.
func (r Reward) Twinkle() int {
	switch r.Tier {
	case RewardTier1:
		return values.AchievementRewardTier1
	case RewardTier2:
		return values.AchievementRewardTier2
	case RewardTier3:
		return values.AchievementRewardTier3
	default:
		return 0
	}
}

// Achievement is one catalog row: a stable id (the FE resolves every user-facing string from it —
// no copy lives server-side), its axis, the one condition, the one reward.
type Achievement struct {
	ID        string
	Axis      Axis
	Condition Condition
	Reward    Reward
}

// ProgressRecord is one achievement_progress row: the two facts that cannot be derived from a
// counter. AchievedAt is never cleared once written ([I1]); ClaimedAt and ClaimID are set together
// or not at all (the DDL CHECK).
type ProgressRecord struct {
	AchievementID string
	AchievedAt    time.Time
	ClaimedAt     *time.Time
	ClaimID       string
}

// Entry is one catalog row answered for one caller: the row, and what is true of it for them —
// all of it derived at read time except the two ProgressRecord facts (ARCHITECTURE §2.9 #3).
type Entry struct {
	Achievement
	// Progress is min(counter, target) — computed at read, never stored.
	Progress int64
	Achieved bool
	Claimed  bool
	// AchievedAt is zero while unachieved.
	AchievedAt time.Time
}

// Achieved is the whole evaluation rule: the counter reached the target. There is no operator to
// invert it and no second signal to combine with ([A1a]).
func Achieved(counter, target int64) bool {
	return counter >= target
}

// Progress clamps a counter to its target, so a client renders 200/200 rather than 3541/200.
func Progress(counter, target int64) int64 {
	return min(counter, target)
}

// The three write rules, owned by the domain rather than by whichever adapter happens to run the
// statement. Every write path — the store's methods today, the tracking use-case's composition
// later — asks these functions, so there is no second place one could be relaxed.

// RequireForwardDelta is the monotonicity rule for an accumulate write: a sum must move forward
// ([I1][A1]). A zero or negative delta is a caller mistake, not a no-op — a producer that has
// nothing to add should not be reporting.
func RequireForwardDelta(delta int64) error {
	if delta <= 0 {
		return ErrNonPositiveDelta
	}
	return nil
}

// RequireReachLevel is the same rule for a reach write, and it deliberately admits zero: a
// high-water mark of zero is a fact a producer can legitimately observe (a user owning no ornaments
// yet reports `ornament_owned = 0`), and GREATEST(value, 0) can only ever be a no-op. Refusing it
// would roll back the save that reported it while lowering nothing.
func RequireReachLevel(level int64) error {
	if level < 0 {
		return ErrNonPositiveDelta
	}
	return nil
}

// RequireCounterMode binds a statement to its key's declared mode. Without it the mode would be
// the caller's choice after all: adding to a reach key turns 단계 도달 into a count, so four
// stage-1 gist views would unlock the stage-4 row without ever reaching stage 4.
func RequireCounterMode(key CounterKey, mode CounterMode) error {
	declared, ok := CounterModeOf(key)
	if !ok {
		return ErrUnknownCounterKey
	}
	if declared != mode {
		return ErrCounterModeMismatch
	}
	return nil
}

// RequireCatalogID refuses a progress write for an unpublished id, so a typo cannot leave a
// durable row that no read will ever answer for and a later claim could still mark paid.
func RequireCatalogID(achievementID string) error {
	if _, published := LookupAchievement(achievementID); !published {
		return ErrUnknownAchievementID
	}
	return nil
}
