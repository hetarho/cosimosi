package achievement

import (
	"math"
	"testing"
)

// The wire carries reward_twinkle as an int32 (the amounts are two- and three-digit), so a values
// edit past the int32 ceiling would wrap silently in the handler's conversion rather than fail.
func TestRewardTiersFitTheWireType(t *testing.T) {
	t.Parallel()
	for _, tier := range []RewardTier{RewardTier1, RewardTier2, RewardTier3} {
		amount := Reward{Tier: tier}.Twinkle()
		if amount <= 0 || int64(amount) > math.MaxInt32 {
			t.Fatalf("tier %v pays %d, which does not fit the int32 wire field", tier, amount)
		}
	}
}

// The catalog self-test: the invariants every future row edit must keep. The cross-catalog half —
// that the two ornament ids resolve to store's achievement-only rows 1:1 — lives at the
// composition root, the one package that sees both catalogs.
func TestCatalogRowsAreWellFormed(t *testing.T) {
	t.Parallel()
	rows := Catalog()
	if len(rows) == 0 {
		t.Fatal("the catalog is empty")
	}
	seen := make(map[string]struct{}, len(rows))
	ornamentRewards := 0
	for _, row := range rows {
		if row.ID == "" {
			t.Fatal("a catalog row has an empty id")
		}
		if _, dup := seen[row.ID]; dup {
			t.Fatalf("catalog id %q is declared twice", row.ID)
		}
		seen[row.ID] = struct{}{}
		if row.Axis == "" {
			t.Fatalf("%s: empty axis", row.ID)
		}
		if row.Condition.Target < 1 {
			t.Fatalf("%s: target %d < 1", row.ID, row.Condition.Target)
		}
		if !KnownCounterKey(row.Condition.Counter) {
			t.Fatalf("%s: counter %q is not in the closed set", row.ID, row.Condition.Counter)
		}
		// Exactly one reward leg: a tier, or an ornament — never both, never neither.
		hasTier := row.Reward.Tier != RewardTierNone
		hasOrnament := row.Reward.OrnamentID != ""
		if hasTier == hasOrnament {
			t.Fatalf("%s: reward must set exactly one of tier/ornament (tier=%v ornament=%q)",
				row.ID, row.Reward.Tier, row.Reward.OrnamentID)
		}
		if hasOrnament {
			ornamentRewards++
			if row.Reward.Twinkle() != 0 {
				t.Fatalf("%s: an ornament reward pays no stardust", row.ID)
			}
		} else if row.Reward.Twinkle() <= 0 {
			t.Fatalf("%s: tier %v resolves to no stardust", row.ID, row.Reward.Tier)
		}
	}
	if ornamentRewards != 2 {
		t.Fatalf("ornament rewards = %d, want exactly 2 ([A3] scarcity)", ornamentRewards)
	}
}

// The slice order is the server-fixed answer order: axes contiguous in axisOrder, and within one
// (axis, counter) pair targets strictly ascending.
func TestCatalogOrderIsTheAnswerOrder(t *testing.T) {
	t.Parallel()
	rows := Catalog()
	axisRank := make(map[Axis]int, len(axisOrder))
	for rank, axis := range axisOrder {
		axisRank[axis] = rank
	}
	lastRank := -1
	lastTargets := map[CounterKey]int64{}
	for _, row := range rows {
		rank, ok := axisRank[row.Axis]
		if !ok {
			t.Fatalf("%s: axis %q missing from axisOrder", row.ID, row.Axis)
		}
		if rank < lastRank {
			t.Fatalf("%s: axis %q out of order", row.ID, row.Axis)
		}
		if rank > lastRank {
			lastRank = rank
			lastTargets = map[CounterKey]int64{}
		}
		if previous, seen := lastTargets[row.Condition.Counter]; seen && row.Condition.Target <= previous {
			t.Fatalf("%s: target %d does not ascend after %d on %q",
				row.ID, row.Condition.Target, previous, row.Condition.Counter)
		}
		lastTargets[row.Condition.Counter] = row.Condition.Target
	}
}

// The variety capstones equal their family's length — the ceiling is derived, never declared, so
// a family edit moves the capstone review here.
func TestVarietyCapstonesMatchFamilyLengths(t *testing.T) {
	t.Parallel()
	maxTarget := map[CounterKey]int64{}
	for _, row := range Catalog() {
		if row.Condition.Target > maxTarget[row.Condition.Counter] {
			maxTarget[row.Condition.Counter] = row.Condition.Target
		}
	}
	if got, want := maxTarget[CounterMoodVariety], int64(len(MoodRecordedFamily())); got != want {
		t.Fatalf("mood_variety capstone = %d, want the family length %d", got, want)
	}
	if got, want := maxTarget[CounterOrnamentKindVariety], int64(len(OrnamentKindDecoratedFamily())); got != want {
		t.Fatalf("ornament_kind_variety capstone = %d, want the family length %d", got, want)
	}
}

func TestLookupAchievement(t *testing.T) {
	t.Parallel()
	if _, ok := LookupAchievement("first_diary"); !ok {
		t.Fatal("first_diary is not published")
	}
	if _, ok := LookupAchievement("consecutive_login_7"); ok {
		t.Fatal("an unpublished id resolved")
	}
}
