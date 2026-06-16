// Ambient "요즘 상태" model (spec 25): the recent fragment emotions, time-weighted over a
// 7-day envelope, summarized into a background tint + a multi-light color distribution.
// Pure — no rendering, no platform import (constitution §4·1.10): the universe canvas (a
// platform layer) consumes these to build the nebula pools; mobile can reuse them as-is.
//
// This is the client fallback / distribution authority. The server sends only the coarse
// `Ambient` summary (hue/sat/arousal/valence); the multi-light color DISTRIBUTION is always
// derived HERE from the loaded stars (coordinates/render inputs are client authority — §3).
// The math mirrors the backend AggregateAmbient (internal/memory/memory.go) so the served
// summary and this fallback agree on the color of "요즘".
import { moodRgb, VALUES, type RGB } from '@/shared/config'

/** The coarse recent-mood summary — matches proto AmbientMood (spec 25). */
export interface Ambient {
  /** 0..360 representative hue (HSV of the intensity-weighted mood blend). */
  hue: number
  /** 0..1 saturation (one dominant emotion → vivid; mixed → washed out). */
  sat: number
  /** 0..1 arousal (recency·intensity) — the excitability-gain input. */
  arousal: number
  /** -1..1 time-weighted mean signed affect — warms/cools the background color. */
  valence: number
}

/** One nebula light pool: a dominant mood's meaning-color (valence-corrected) + its
 *  relative weight (pool brightness/size). The canvas scatters one additive orb per pool. */
export interface AmbientLight {
  rgb: RGB
  /** relative share 0..1 — bigger = brighter/larger pool. */
  weight: number
  mood: string
}

/** A loaded star's affect, the input to the derivations. lastRecalledAt is epoch ms. */
export interface AmbientStar {
  mood: string
  intensity: number
  valence: number
  lastRecalledAt: number
}

export const TAU_MOOD_DAYS = VALUES.ambient.tauMoodDays
export const AROUSAL_GAIN = VALUES.ambient.arousalGain
/** Upper bound on light pools (only the top dominant moods become their own light). */
export const AMBIENT_LIGHTS_K = VALUES.ambient.lightsK
/** A mood below this relative weight isn't its own pool (avoids faint stragglers). */
const LIGHT_MIN_SHARE = VALUES.ambient.lightMinShare
const DAY_MS = 86_400_000

/** g = 1 + 0.3·arousal (arousal∈[0,1] → gain∈[1,1.3]). Mirrors memory.ExcitabilityGain. */
export const excitabilityGain = (a: Ambient): number => 1 + AROUSAL_GAIN * a.arousal

/** Time-weighted emotional weight of one star: intensity·exp(-Δt/τ). An older/fainter
 *  fragment weighs monotonically less; the 7-day envelope is slow (days, not hours). */
function weightOf(star: AmbientStar, now: number): number {
  const dtDays = Math.max(0, (now - star.lastRecalledAt) / DAY_MS)
  const intensity = Math.max(0, star.intensity)
  return intensity * Math.exp(-dtDays / TAU_MOOD_DAYS)
}

/** Fold loaded stars into the coarse summary (the client fallback for a missing/empty
 *  server `ambient`). Empty/zero-weight input → neutral (all-zero) → gain 1.0. */
export function deriveAmbient(stars: readonly AmbientStar[], now: number): Ambient {
  let sumW = 0
  let sumWV = 0
  let r = 0
  let g = 0
  let b = 0
  for (const s of stars) {
    const w = weightOf(s, now)
    if (w <= 0) continue
    const rgb = moodRgb(s.mood)
    r += w * rgb[0]
    g += w * rgb[1]
    b += w * rgb[2]
    sumW += w
    sumWV += w * s.valence
  }
  if (sumW <= 0) return { hue: 0, sat: 0, arousal: 0, valence: 0 }
  const [hue, sat] = rgbToHueSat(r / sumW, g / sumW, b / sumW)
  return {
    hue,
    sat,
    arousal: 1 - Math.exp(-sumW),
    valence: clamp(sumWV / sumW, -1, 1),
  }
}

/** Representative single color of the summary (moodRgb space + valence correction).
 *  Theme-independent: mood meaning-color is preserved regardless of the chosen theme. */
export function ambientToRgb(a: Ambient): RGB {
  return correctByValence(hsvToRgb(a.hue, a.sat, 1), a.valence)
}

/** Top-K dominant moods → light pools. Each mood accumulates a time-weighted share and a
 *  weighted valence; pools below LIGHT_MIN_SHARE are dropped and the rest sorted desc and
 *  capped at K. A single-mood "요즘" collapses to one pool; an empty universe → [] (the
 *  background is then the theme base only). Pool color = moodRgb valence-corrected. */
export function ambientLights(stars: readonly AmbientStar[], now: number): AmbientLight[] {
  const byMood = new Map<string, { w: number; wv: number }>()
  let total = 0
  for (const s of stars) {
    const w = weightOf(s, now)
    if (w <= 0) continue
    const cur = byMood.get(s.mood) ?? { w: 0, wv: 0 }
    cur.w += w
    cur.wv += w * s.valence
    byMood.set(s.mood, cur)
    total += w
  }
  if (total <= 0) return []
  return [...byMood.entries()]
    .map(([mood, { w, wv }]) => ({ mood, share: w / total, valence: clamp(wv / w, -1, 1) }))
    .filter((l) => l.share >= LIGHT_MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, AMBIENT_LIGHTS_K)
    .map((l) => ({ rgb: correctByValence(moodRgb(l.mood), l.valence), weight: l.share, mood: l.mood }))
}

/** Warm/cool + saturate/desaturate a meaning-color by valence (spec 1.8): positive →
 *  warmer & more saturated (gold/rose), negative → cooler & duller (teal/violet). Subtle. */
function correctByValence(rgb: RGB, v: number): RGB {
  const warm = VALUES.ambient.valenceWarmGain * v
  const r = clamp01(rgb[0] + warm)
  const b = clamp01(rgb[2] - warm)
  const g = rgb[1]
  const lum = 0.3 * r + 0.59 * g + 0.11 * b
  const satK = 1 + VALUES.ambient.valenceSatGain * v
  return [clamp01(lum + (r - lum) * satK), clamp01(lum + (g - lum) * satK), clamp01(lum + (b - lum) * satK)]
}

/** Linear RGB → [hue 0..360, sat 0..1]. Value dropped (brightness comes from arousal). */
function rgbToHueSat(r: number, g: number, b: number): [number, number] {
  const maxc = Math.max(r, g, b)
  const minc = Math.min(r, g, b)
  if (maxc <= 0) return [0, 0]
  const sat = (maxc - minc) / maxc
  const delta = maxc - minc
  if (delta === 0) return [0, sat]
  let hue: number
  if (maxc === r) hue = ((g - b) / delta) % 6
  else if (maxc === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return [hue, sat]
}

/** [hue (any), sat 0..1, val 0..1] → linear RGB. Hue is normalized into [0,360) first so
 *  the chroma offset and the sextant agree even for an out-of-range hue. */
function hsvToRgb(hue: number, s: number, v: number): RGB {
  const h = ((hue % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const seg = Math.floor(h / 60) % 6
  const base: readonly [number, number, number] =
    seg === 0
      ? [c, x, 0]
      : seg === 1
        ? [x, c, 0]
        : seg === 2
          ? [0, c, x]
          : seg === 3
            ? [0, x, c]
            : seg === 4
              ? [x, 0, c]
              : [c, 0, x]
  return [base[0] + m, base[1] + m, base[2] + m]
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
function clamp01(v: number): number {
  return clamp(v, 0, 1)
}
