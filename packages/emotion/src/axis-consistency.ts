import { VALUES } from '@cosimosi/config'

import { MOODS, moodCoordinate, type Mood } from './mood.ts'
import { type Color, type MoodPalette } from './palette.ts'

export interface PaletteAxisWarning {
  readonly mood: Mood
  readonly issue: 'valence_hue_mismatch'
  /** The mood's stored valence (the axis the color should agree with). */
  readonly valence: number
  /** The color's warm/cool reading in [-1, 1] (+1 warmest, -1 coolest). */
  readonly warmth: number
  /** How far the color contradicts the valence direction — the value compared to the threshold. */
  readonly severity: number
}

// A quality check, not the meaning guard: it never throws and never blocks a swap. It reads each
// mood color's warm/cool value from its hue and flags where that contradicts the mood's valence
// (a cool color on a pleasant mood, a warm color on an unpleasant one) beyond the tuned
// tolerance, so a palette cannot silently strip the "warm = positive / cool = negative" reading.
// An empty result means the palette is axis-consistent.
export function checkPaletteAxisConsistency(palette: MoodPalette): PaletteAxisWarning[] {
  const threshold = VALUES.palette.axisWarnValenceThreshold
  const warnings: PaletteAxisWarning[] = []
  for (const mood of MOODS) {
    const valence = moodCoordinate(mood).valence
    const warmth = hueWarmth(palette.colors[mood])
    // Warmth and valence should share a sign; their negated product is the contradiction, scaled
    // by valence strength, so a near-neutral mood is judged leniently and a strong one strictly.
    const severity = Math.max(0, -(warmth * valence))
    if (severity > threshold) {
      warnings.push({ mood, issue: 'valence_hue_mismatch', valence, warmth, severity })
    }
  }
  return warnings
}

// Orange-gold reads warmest; its hue-circle antipode (~220°, azure) reads coolest.
const WARM_PEAK_DEG = 40

// The color's warm/cool value in [-1, 1], derived from hue alone: a cosine peaked at the warm
// hue, so warmth falls off smoothly toward the cool antipode. Saturation/lightness do not enter —
// the axis reading is about which side of the wheel the color sits on.
function hueWarmth(color: Color): number {
  const hue = hueDegrees(color)
  return Math.cos(((hue - WARM_PEAK_DEG) * Math.PI) / 180)
}

// The hue angle (0..360°) of a #rrggbb color, standard HSL derivation. A fully desaturated color
// has no meaningful hue and resolves to 0° (red); it never produces a warning on its own because
// only a strong-valence mood with a contradicting hue crosses the threshold.
function hueDegrees(color: Color): number {
  const r = parseInt(color.slice(1, 3), 16) / 255
  const g = parseInt(color.slice(3, 5), 16) / 255
  const b = parseInt(color.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) {
    return 0
  }
  let hue: number
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  hue *= 60
  return hue < 0 ? hue + 360 : hue
}
