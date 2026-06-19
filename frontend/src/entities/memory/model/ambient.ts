// Ambient "요즘 상태" model (spec 07, was 25): the recent emotions ranked by the SINGLE Bjork
// retrieval strength R (weight.ts) — the same weight that drives the self-proximity radius (38).
// rankedEmotions feeds the BACKGROUND weave (top-N user emotion colors woven into the skin),
// arousalOf drives the background's global liveliness, and deriveAmbient/ambientToRgb still give
// the SELF body color (spec 44 J3). Pure — no rendering, no platform import (constitution §4·1.10).
//
// spec 07 retired the server ambient summary AND the floating mood-orb light pools (ambientLights):
// the client derives everything HERE from the loaded stars (+recall_count). No fixed moodRgb in the
// background path — the woven colors are the USER's emotion colors (resolveMoodRgb, spec 45).
import { moodRgb, resolveMoodRgb, VALUES, type RGB } from '@/shared/config'
import { memoryR } from './weight'

/** The coarse recent-mood summary — drives the SELF body color (spec 44 J3). */
export interface Ambient {
  /** 0..360 representative hue (HSV of the R-weighted mood blend). */
  hue: number
  /** 0..1 saturation (one dominant emotion → vivid; mixed → washed out). */
  sat: number
  /** 0..1 arousal (Σ R) — the excitability-gain + background-liveliness input. */
  arousal: number
  /** -1..1 R-weighted mean signed affect — warms/cools the self body color. */
  valence: number
}

/** A loaded star's affect + the raw recall datum, the input to the R derivations.
 *  lastRecalledAt is epoch ms; recallCount is the spec-07 cumulative count. */
export interface AmbientStar {
  mood: string
  intensity: number
  valence: number
  lastRecalledAt: number
  recallCount: number
}

/** One ranked emotion for the background weave: the user's emotion color + its share of the
 *  total Bjork retrieval strength (R). The background skin weaves the top-N (skin emotionSlots). */
export interface RankedEmotion {
  mood: string
  rgb: RGB
  /** relative share 0..1 of Σ R across moods (bigger = more present in the weave). */
  weight: number
}

export const AROUSAL_GAIN = VALUES.ambient.arousalGain

/** g = 1 + 0.3·arousal (arousal∈[0,1] → gain∈[1,1.3]). Mirrors memory.ExcitabilityGain (22 seam). */
export const excitabilityGain = (a: Ambient): number => 1 + AROUSAL_GAIN * a.arousal

/** A star's Bjork retrieval strength R — the single weight for radius AND background ranking. */
function rOf(star: AmbientStar, now: number): number {
  return memoryR(star.recallCount, star.intensity, star.lastRecalledAt, now)
}

/** Total Σ R over the loaded stars → arousal ∈ [0,1): a vivid, recent "요즘" reads as more
 *  aroused. Empty/dormant universe → ≈0. Drives the background skin's global liveliness (07). */
export function arousalOf(stars: readonly AmbientStar[], now: number): number {
  let sum = 0
  for (const s of stars) sum += rOf(s, now)
  return 1 - Math.exp(-sum)
}

/** Emotion ranking for the background weave (spec 07): each mood's Σ R, descending, with the
 *  USER's emotion color (resolveMoodRgb — spec 45) and its relative share of the total Σ R. The
 *  background skin weaves the top-N by its `emotionSlots`. `emotionColors` is injected (mood →
 *  "#RRGGBB") so this stays a pure entity module (no settings cross-import). Empty universe → []. */
export function rankedEmotions(
  stars: readonly AmbientStar[],
  emotionColors: Record<string, string> | undefined,
  now: number,
): RankedEmotion[] {
  const byMood = new Map<string, number>()
  let total = 0
  for (const s of stars) {
    const r = rOf(s, now)
    if (r <= 0) continue
    byMood.set(s.mood, (byMood.get(s.mood) ?? 0) + r)
    total += r
  }
  if (total <= 0) return []
  return [...byMood.entries()]
    .map(([mood, r]) => ({ mood, rgb: resolveMoodRgb(mood, emotionColors), weight: r / total }))
    .sort((a, b) => b.weight - a.weight)
}

/** Fold loaded stars into the coarse summary that gives the SELF body color (spec 44 J3). The
 *  weight is the Bjork retrieval strength R (spec 07) instead of the old intensity·exp(-Δt/τ).
 *  Self color stays on the fixed mood meaning-palette (moodRgb), NOT the user colors — the body
 *  reads emotion, while the background weaves the user's chosen colors. Empty → neutral (gain 1.0). */
export function deriveAmbient(stars: readonly AmbientStar[], now: number): Ambient {
  let sumW = 0
  let sumWV = 0
  let r = 0
  let g = 0
  let b = 0
  for (const s of stars) {
    const w = rOf(s, now)
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
 *  Theme-independent: mood meaning-color is preserved regardless of the chosen background. */
export function ambientToRgb(a: Ambient): RGB {
  return correctByValence(hsvToRgb(a.hue, a.sat, 1), a.valence)
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
