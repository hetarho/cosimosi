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
