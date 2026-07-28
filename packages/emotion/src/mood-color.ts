import { VALUES } from '@cosimosi/config'

import { MOODS, type Mood } from './mood.ts'
import { colorToOkLch, deltaEOkLab, okLchToColor } from './oklab.ts'
import { defaultMoodPalette, defineMoodPalette, type Color, type MoodPalette } from './palette.ts'

// These are the existing 300/400/500 lightness steps authored by packages/ui/src/palette.ts.
export const EMOTION_LIGHTNESS_STEPS = [0.8, 0.72, 0.63] as const

export interface MoodColorRow {
  readonly mood: Mood
  readonly color: Color
}

export function snapToEmotionStep(color: Color): Color {
  const lch = colorToOkLch(color)
  const lightness = EMOTION_LIGHTNESS_STEPS.reduce((nearest, step) =>
    Math.abs(step - lch.l) < Math.abs(nearest - lch.l) ? step : nearest,
  )
  return okLchToColor({ ...lch, l: lightness })
}

export function nearDuplicateMood(
  color: Color,
  chosen: Readonly<Partial<Record<Mood, Color>>>,
): Mood | undefined {
  return MOODS.find(
    (mood) =>
      chosen[mood] !== undefined &&
      deltaEOkLab(color, chosen[mood]) < VALUES.palette.similarDeltaEMin,
  )
}

export function resolveMoodColors(
  rows: readonly MoodColorRow[],
  fallback: MoodPalette = defaultMoodPalette,
): MoodPalette {
  const colors = { ...fallback.colors }
  for (const row of rows) colors[row.mood] = row.color
  return defineMoodPalette('per-mood', colors)
}
