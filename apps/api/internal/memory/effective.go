package memory

// Read-time-derivation seams reserved for the forgetting/recall dynamics: strength will grow
// with recall accumulation and brightness will decay from elapsed universe time. Until those
// dynamics exist they are the identity (base strength, full brightness), so callers can read
// through them now without a later signature change.

func EffectiveStrength(baseStrength float64, _ int32) float64 {
	return baseStrength
}

func EffectiveBrightness(_ float64) float64 {
	return 1.0
}
