package testregistry

import "testing"

func TestMoodColorAggregateClaimsHaveOneOwnerPerMood(t *testing.T) {
	seen := map[string]MoodColorAggregateOwner{}
	withdrawalClaims := 0
	for _, claim := range MoodColorAggregateClaims {
		if claim.Mood == "" || claim.Owner == "" {
			t.Fatalf("empty aggregate claim: %+v", claim)
		}
		if owner, exists := seen[claim.Mood]; exists {
			t.Fatalf("mood %q is claimed by both %q and %q", claim.Mood, owner, claim.Owner)
		}
		seen[claim.Mood] = claim.Owner
		if claim.Owner == MoodColorAggregateOwnerWithdrawalTest {
			withdrawalClaims++
		}
	}
	if withdrawalClaims != 1 {
		t.Fatalf("withdrawal aggregate claims = %d, want exactly one", withdrawalClaims)
	}
}
