// Elapsed universe-time in days between two universe timestamps — the single input the
// read-time decay functions (effectiveBrightness, effectiveSynapseStrength) consume. Universe
// time is an ISO DATE (date-only), so both operands parse as UTC midnight (no timezone drift).
// Elapsed is floored at 0: a not-yet-launched universe (null "now") or a future reference reads
// as no elapsed time, and a non-parseable input coerces to 0 rather than propagating NaN.
export function elapsedUniverseDays(fromUniverseTime: string, universeTime: string | null): number {
  if (!universeTime) return 0
  const from = Date.parse(fromUniverseTime)
  const now = Date.parse(universeTime)
  if (Number.isNaN(from) || Number.isNaN(now)) return 0
  return Math.max(0, (now - from) / 86_400_000)
}
