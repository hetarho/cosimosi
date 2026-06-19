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
 *  Δt it keeps a higher R than a once-recalled one. Just recalled (Δt≈0) → R≈1. */
export function retrievalStrength(s: number, dtDays: number): number {
  const tau = TAU0_DAYS * (1 + TAU_STORAGE_GAIN * Math.log1p(Math.max(0, s)))
  return Math.exp(-Math.max(0, dtDays) / tau)
}

/** R directly from a star's raw fields — the value the radius (38) and the background emotion
 *  ranking both read. dtDays = (now − lastRecalledAt)/day, floored at 0 (clock skew). */
export function memoryR(recallCount: number, intensity: number, lastRecalledAt: number, now: number): number {
  return retrievalStrength(storageStrength(recallCount, intensity), (now - lastRecalledAt) / DAY_MS)
}
