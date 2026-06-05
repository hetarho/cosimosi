// Forgetting model (Architecture §6, concept §망각). Pure, unit-tested. MVP is pure
// time decay (single λ); relevance/emotion-weighted decay is v1+ (#23).
export const HALF_LIFE_DAYS = 30
export const LAMBDA = Math.LN2 / HALF_LIFE_DAYS // ≈ 0.0231 /day
/** Minimum brightness floor — a star never goes dark / disappears (constitution §2). */
export const A_MIN = 0.05
const DAY_MS = 86_400_000

/** activation(Δt) = exp(-λ·Δt_days) ∈ (0,1]; Δt=0 → 1, 30 days → 0.5. */
export function activation(lastRecalledAt: number, now: number): number {
  const dtDays = Math.max(0, (now - lastRecalledAt) / DAY_MS)
  return Math.exp(-LAMBDA * dtDays)
}

/** Effective star brightness, floored at A_MIN (dormant stars still glow faintly). */
export function starBrightness(lastRecalledAt: number, now: number): number {
  return Math.max(A_MIN, activation(lastRecalledAt, now))
}

// --- spec 12 additions (08 symbols above are reused, never redefined) ---

/** Effective synapse brightness = weight · max(A_MIN, activation). Floored like a star
 *  (a dormant link dims but never vanishes — constitution §2). `now` is injected. */
export function synapseBrightness(weight: number, lastActivatedAt: number, now: number): number {
  return weight * Math.max(A_MIN, activation(lastActivatedAt, now))
}

/** Dormant when RAW activation (before the brightness floor) has fallen to/below the
 *  threshold (default 2·A_MIN). Threshold is on raw activation, not floored brightness,
 *  so it stays meaningful below A_MIN. The server mirrors this in dormantCutoff. */
export function isDormant(lastRecalledAt: number, now: number, threshold = 2 * A_MIN): boolean {
  return activation(lastRecalledAt, now) <= threshold
}
