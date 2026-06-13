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

// ── Relevance/emotion-weighted decay (spec 26) ───────────────────────────────────────
// 12 above is a single global λ (pure time decay). 26 modulates λ PER STAR so a star that
// is well-connected, aligned with the user's recent themes, or emotionally intense fades
// SLOWER — "forgetting is a function of relevance, not just time" (concept.md §망각). These
// are additions; LAMBDA / A_MIN / activation / starBrightness above are reused unchanged, and
// the floor stays A_MIN (the single constitution-§2 floor — 00.overview 공유 설계 결정; the
// landing card's 0.12 was a demo value, not a second floor).

/** R_conn coefficient: more connections (degree) → more decay resistance. */
export const ALPHA_CONN = 0.6
/** R_recent coefficient: closer to the "요즘 토픽" (relevance↑) → more decay resistance. */
export const BETA_RECENT = 0.5
/** R_emo coefficient on arousal (intensity): stronger emotion → more decay resistance
 *  (amygdala-mediated consolidation — concept.md). */
export const GAMMA_EMO = 0.7
/** R_emo coefficient on negative valence: a strong NEGATIVE affect resists decay extra
 *  (Kensinger & Corkin 2004 — negative events are remembered more durably). */
export const DELTA_VAL = 0.4

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Per-star modulated decay rate (spec 26): λ_eff = λ_base · R_conn · R_recent · R_emo, with
 *  each R ∈ (0,1] so modulation only ever SLOWS decay (never accelerates past λ_base — 4.2).
 *    R_conn  = 1/(1 + ALPHA_CONN·degreeNorm)              degree = links / median(links)
 *    R_recent= 1/(1 + BETA_RECENT·relevance)              relevance = cos(star_emb, 요즘 토픽) ∈ [0,1]
 *    R_emo   = 1/(1 + GAMMA_EMO·intensity + DELTA_VAL·max(0,-valence))   arousal + signed affect
 *  Every input is clamped, so a stray degreeNorm<0 / intensity>1 / |valence|>1 can't produce
 *  λ_eff > λ_base or brightness > 1 (4.2). */
export function lambdaEff(
  degreeNorm: number,
  relevance: number,
  intensityNorm: number,
  valence: number,
): number {
  const rConn = 1 / (1 + ALPHA_CONN * Math.max(0, degreeNorm))
  const rRecent = 1 / (1 + BETA_RECENT * clamp01(relevance))
  const v = valence < -1 ? -1 : valence > 1 ? 1 : valence
  const emo = GAMMA_EMO * clamp01(intensityNorm) + DELTA_VAL * Math.max(0, -v)
  const rEmo = 1 / (1 + emo)
  return LAMBDA * rConn * rRecent * rEmo
}

/** Modulated star brightness (spec 26) = A_MIN + (1-A_MIN)·exp(-λ_eff·Δt_days), so it
 *  decays from 1 at Δt=0 toward the A_MIN floor — never below it, never deleting the star
 *  (constitution §2). Drop-in replacement for `starBrightness` with the extra λ_eff inputs;
 *  the spec-23 reshaping offset is composited at the call site (StarField), as before. */
export function modulatedBrightness(
  lastRecalledAt: number,
  now: number,
  degreeNorm: number,
  relevance: number,
  intensityNorm: number,
  valence: number,
): number {
  const dtDays = Math.max(0, (now - lastRecalledAt) / DAY_MS)
  const le = lambdaEff(degreeNorm, relevance, intensityNorm, valence)
  return A_MIN + (1 - A_MIN) * Math.exp(-le * dtDays)
}
