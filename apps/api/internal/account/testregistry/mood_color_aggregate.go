package testregistry

type MoodColorAggregateOwner string

const (
	MoodColorAggregateOwnerAccountTests   MoodColorAggregateOwner = "account-tests"
	MoodColorAggregateOwnerWithdrawalTest MoodColorAggregateOwner = "withdrawal-test"
)

type MoodColorAggregateClaim struct {
	Mood  string
	Owner MoodColorAggregateOwner
}

// MoodColorAggregateClaims coordinates integration packages that share the global
// mood_color_counts projection. Every mood used as an aggregate fixture has one owner.
var MoodColorAggregateClaims = [...]MoodColorAggregateClaim{
	{Mood: "JOY", Owner: MoodColorAggregateOwnerAccountTests},
	{Mood: "CALM", Owner: MoodColorAggregateOwnerAccountTests},
	{Mood: "STRESS", Owner: MoodColorAggregateOwnerAccountTests},
	{Mood: "EMPTINESS", Owner: MoodColorAggregateOwnerWithdrawalTest},
}

func MoodColorAggregateOwnerOf(mood string) (MoodColorAggregateOwner, bool) {
	for _, claim := range MoodColorAggregateClaims {
		if claim.Mood == mood {
			return claim.Owner, true
		}
	}
	return "", false
}

func MoodColorAggregateMoodFor(owner MoodColorAggregateOwner) (string, bool) {
	for _, claim := range MoodColorAggregateClaims {
		if claim.Owner == owner {
			return claim.Mood, true
		}
	}
	return "", false
}
