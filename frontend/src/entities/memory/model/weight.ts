// Bjork memory weight (spec 07): storage strength S (cumulative, monotone non-decreasing)
// + retrieval strength R (current accessibility, time decay). A SINGLE scientific weight
// that replaces the old three-way split — it drives BOTH the self-proximity radius (38) and
// the background emotion ranking. Pure: no three/React/DOM (헌법4) — mobile reuses it as-is.
//
// Science: Bjork & Bjork New Theory of Disuse — storage vs retrieval strength, the spacing
// effect, and emotional consolidation. Storage strength only grows; retrieval strength is the
// momentary accessibility that decays, slower the more consolidated (higher S) the memory is.
import { VALUES } from '@/shared/config'

const DAY_MS = 86_400_000
const STORAGE_BASE = VALUES.memoryWeight.storageBase
const EMO_CONSOLIDATION = VALUES.memoryWeight.emoConsolidation
const TAU0_DAYS = VALUES.memoryWeight.tau0Days
const TAU_STORAGE_GAIN = VALUES.memoryWeight.tauStorageGain
const CONN_DRIFT_ALPHA = VALUES.radialLayout.connDriftAlpha
const CONN_WEIGHT_TERM = VALUES.radialLayout.connWeightTerm

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Storage strength S (Bjork): cumulative and monotone non-decreasing. A memory is encoded at
 *  STORAGE_BASE and accumulates with each recall; emotional intensity deepens each recall's
 *  consolidation (정서적 기억일수록 깊이 새겨짐). recallCount is the persisted raw datum (server).
 *  S never shrinks — only Δt (in R below) lowers accessibility. */
export function storageStrength(recallCount: number, intensity: number): number {
  const n = Math.max(0, recallCount)
  return (STORAGE_BASE + n) * (1 + EMO_CONSOLIDATION * clamp01(intensity))
}

/** Retrieval strength R = exp(-Δt / τ(S)) ∈ (0,1]: current accessibility under time decay.
 *  τ(S) = tau0_days·(1 + tau_storage_gain·ln(1+S)) GROWS with S — the spacing effect / power
 *  law: a well-consolidated (often-recalled, emotional) memory forgets slowly, so at the same
 *  Δt it keeps a higher R than a once-recalled one. Just recalled (Δt≈0) → R≈1. `tauGain` ≥ 0
 *  is an OPTIONAL extra τ multiplier (1+tauGain) that only SLOWS decay further — connectivity
 *  feeds it for the radius (memoryRadiusR); ambient/ranking leaves it 0 (unchanged). */
export function retrievalStrength(s: number, dtDays: number, tauGain = 0): number {
  const tau = TAU0_DAYS * (1 + TAU_STORAGE_GAIN * Math.log1p(Math.max(0, s))) * (1 + Math.max(0, tauGain))
  return Math.exp(-Math.max(0, dtDays) / tau)
}

/** R directly from a star's raw fields — the value the radius (38) and the background emotion
 *  ranking both read. dtDays = (now − lastRecalledAt)/day, floored at 0 (clock skew). */
export function memoryR(recallCount: number, intensity: number, lastRecalledAt: number, now: number): number {
  return retrievalStrength(storageStrength(recallCount, intensity), (now - lastRecalledAt) / DAY_MS)
}

/** Combined connectedness for the radius (spec 38 change 18): degree count + Σweight, mirroring
 *  the self-glow channel's blend (activation.ts connectedness) but with its OWN knob so the two
 *  channels tune independently. ≥ 0; a normal star ≈ 1, hubs above. */
export function radiusConnectedness(degreeNorm: number, weightedDegreeNorm: number): number {
  return Math.max(0, degreeNorm) + CONN_WEIGHT_TERM * Math.max(0, weightedDegreeNorm)
}

/** Retrieval strength for the self-proximity RADIUS (spec 38), with a connectivity term that only
 *  SLOWS decay: well-connected memories extend τ (·(1+α·connectedness)), so at the same Δt they
 *  keep a higher R → a smaller radius (links pull a memory toward the centre, never push it out —
 *  same direction as λ_eff, plan 26 §4.2). connectedness=0 → identical to memoryR. R ≤ 1 always,
 *  so connectivity can never pull a star inside R_MIN nor make it farther than an unconnected one. */
export function memoryRadiusR(
  recallCount: number,
  intensity: number,
  lastRecalledAt: number,
  now: number,
  connectedness: number,
): number {
  const tauGain = CONN_DRIFT_ALPHA * Math.max(0, connectedness)
  return retrievalStrength(storageStrength(recallCount, intensity), (now - lastRecalledAt) / DAY_MS, tauGain)
}
