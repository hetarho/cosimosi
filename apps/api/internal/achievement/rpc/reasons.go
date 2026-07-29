package rpc

const (
	// The read has one failure mode — an unauthenticated caller — because nothing is requested.
	reasonScopeRequired = "ACHIEVEMENT_SCOPE_REQUIRED"
	reasonInputRequired = "ACHIEVEMENT_INPUT_REQUIRED"
	reasonNotFound      = "ACHIEVEMENT_NOT_FOUND"
	// reasonNotAchieved is the claim's own refusal: a met condition is a precondition for the
	// reward, so an unmet one is answered rather than half-paid.
	reasonNotAchieved = "ACHIEVEMENT_NOT_ACHIEVED"
	// reasonRewardUnavailable is a granter refusal AFTER the claim was recorded. The claim stands
	// and the next attempt replays it, so the copy must not read as "you lost the reward".
	reasonRewardUnavailable = "ACHIEVEMENT_REWARD_UNAVAILABLE"
)
