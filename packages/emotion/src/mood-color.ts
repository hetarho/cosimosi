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

/**
 * The step a lightness belongs to. Exported so a picker can offer the three steps and mark the one a
 * color already sits at, using the same rule `snapToEmotionStep` corrects with.
 */
export function nearestEmotionStep(lightness: number): number {
  return EMOTION_LIGHTNESS_STEPS.reduce((nearest, step) =>
    Math.abs(step - lightness) < Math.abs(nearest - lightness) ? step : nearest,
  )
}

export function snapToEmotionStep(color: Color): Color {
  const lch = colorToOkLch(color)
  return okLchToColor({ ...lch, l: nearestEmotionStep(lch.l) })
}

/**
 * The first feeling already wearing a color this close, or nothing. `except` is the mood being
 * edited: a color is never too close to the color it is replacing, and the table handed in is usually
 * the whole palette rather than a pre-filtered copy of it.
 */
export function nearDuplicateMood(
  color: Color,
  chosen: Readonly<Partial<Record<Mood, Color>>>,
  except?: Mood,
): Mood | undefined {
  return MOODS.find(
    (mood) =>
      mood !== except &&
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
