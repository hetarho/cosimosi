import { VALUES } from '@/shared/config'
import { R_MIN, R_MAX, starRadius } from '@/shared/lib'
import { radiusConnectedness } from './weight'

// Forgetting model (Architecture §6, concept §망각). Pure, unit-tested. `activation` is the
// global time-decay factor that drives SYNAPSE brightness (spec 12) and the dormancy cutoff;
// the STAR render brightness is no longer an independent decay — it is the self-distance radius
// read back as light (brightnessFromRadius, spec 38 change 19). A_MIN / half-life are canonical
// in spec/values.yaml (generated).
export const HALF_LIFE_DAYS = VALUES.decay.halfLifeDays
export const LAMBDA = Math.LN2 / HALF_LIFE_DAYS // ≈ 0.0231 /day
/** Minimum brightness floor — a star never goes dark / disappears (constitution §2). */
export const A_MIN = VALUES.decay.aMin
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

/** Effective synapse brightness = weight · max(A_MIN, activation). Floored like a star
 *  (a dormant link dims but never vanishes — constitution §2). `now` is injected. */
export function synapseBrightness(weight: number, lastActivatedAt: number, now: number): number {
  return weight * Math.max(A_MIN, activation(lastActivatedAt, now))
}

/** Dormant when RAW activation (before the brightness floor) has fallen to/below the
 *  threshold (default 2·A_MIN). Threshold is on raw activation, not floored brightness,
 *  so it stays meaningful below A_MIN. The server mirrors this in dormantCutoff. */
export function isDormant(
  lastRecalledAt: number,
  now: number,
  threshold = VALUES.decay.dormantFactor * A_MIN,
): boolean {
  return activation(lastRecalledAt, now) <= threshold
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// ── Brightness = distance (spec 38 change 19) ─────────────────────────────────────────
// Forgetting is now ONE variable: a memory's self-distance radius. Brightness has no decay
// model of its own — it is the radius read back as light (a near star is bright, the dormant
// outer reaches sit at the A_MIN floor). Connection / recall / recency reach brightness only
// THROUGH the radius (they already shape it — spec 38·07·change 18), so a well-connected,
// recently-recalled memory is near AND bright with no separate term. The old spec-26 λ_eff
// modulation (R_conn·R_recent·R_emo) and the connectedness-driven self-glow channel are gone;
// the central self-light (reflection, distance-based) is the render carrier, color stays mood.

/** Brightness from the self-distance radius: R_MIN → 1 (beside the self star), R_MAX → A_MIN
 *  (the dormant outer reaches), linear and monotone decreasing in radius. Floored at A_MIN so a
 *  star never goes dark (헌법2). The single forgetting read — no time/connection/emotion term. */
export function brightnessFromRadius(radius: number): number {
  const t = clamp01((radius - R_MIN) / (R_MAX - R_MIN))
  return A_MIN + (1 - A_MIN) * (1 - t)
}

/** Star render brightness from a star's raw fields (spec 38 change 19): compute the SAME
 *  self-distance radius the layout places it at (Bjork retrieval strength + connectivity →
 *  targetRadius), then read it back as brightness. degreeNorm/weightedDegreeNorm come from the
 *  synapse graph (degreeNormById/weightedDegreeById) so connection slows the drift outward and
 *  thus keeps the star bright — through the radius, not a separate channel. Pure (헌법4). */
export function starGlow(
  recallCount: number,
  intensity: number,
  lastRecalledAt: number,
  now: number,
  degreeNorm: number,
  weightedDegreeNorm: number,
): number {
  const conn = radiusConnectedness(degreeNorm, weightedDegreeNorm)
  const radius = starRadius(recallCount, intensity, lastRecalledAt, now, conn)
  return brightnessFromRadius(radius)
}
