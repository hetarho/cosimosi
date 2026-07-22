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
    const warmth = colorWarmth(palette.colors[mood])
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

// A desaturated color has little hue evidence, so saturation attenuates the hue-circle reading and
// makes grayscale exactly neutral instead of treating its arbitrary HSL hue as red.
export function colorWarmth(color: Color): number {
  const { hue, saturation } = hslHueAndSaturation(color)
  return Math.cos(((hue - WARM_PEAK_DEG) * Math.PI) / 180) * saturation
}

function hslHueAndSaturation(color: Color): { hue: number; saturation: number } {
  const r = parseInt(color.slice(1, 3), 16) / 255
  const g = parseInt(color.slice(3, 5), 16) / 255
  const b = parseInt(color.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return { hue: 0, saturation: 0 }

  const lightness = (max + min) / 2
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  hue *= 60
  return { hue: hue < 0 ? hue + 360 : hue, saturation }
}
