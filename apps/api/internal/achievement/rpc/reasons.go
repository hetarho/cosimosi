package rpc

// The read's only refusal: nothing is requested, so an unknown id, a bad cursor or an invalid
// argument cannot occur — the one failure mode is an unauthenticated caller.
const reasonScopeRequired = "ACHIEVEMENT_SCOPE_REQUIRED"
