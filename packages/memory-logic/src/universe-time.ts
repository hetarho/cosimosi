// Elapsed universe-time in days between two universe timestamps — the single input the
// read-time decay functions (effectiveBrightness, effectiveSynapseStrength) consume. Universe
// time is an ISO DATE (date-only), so both operands parse as UTC midnight (no timezone drift).
// Elapsed is floored at 0: a not-yet-launched universe (null "now") or a future reference reads
// as no elapsed time, and a non-parseable input coerces to 0 rather than propagating NaN.
export function elapsedUniverseDays(fromUniverseTime: string, universeTime: string | null): number {
  return elapsedUniverseDaysMs(Date.parse(fromUniverseTime), universeTimeMs(universeTime))
}

// The same measure over timestamps already parsed with `universeTimeMs`, for a caller that holds
// many anchors against one clock and would otherwise re-parse every anchor at every clock step.
export function elapsedUniverseDaysMs(fromMs: number, nowMs: number): number {
  if (Number.isNaN(fromMs) || Number.isNaN(nowMs)) return 0
  return Math.max(0, (nowMs - fromMs) / 86_400_000)
}

/** A universe timestamp as epoch milliseconds; NaN for a missing or unparseable one (no elapsed time). */
export function universeTimeMs(universeTime: string | null): number {
  return universeTime ? Date.parse(universeTime) : Number.NaN
}
