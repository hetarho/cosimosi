import { VALUES } from '@cosimosi/config'

import { relativeLuminance } from './gamut.ts'
import type { Mood } from './mood.ts'
import { colorToOkLch } from './oklab.ts'
import { defaultMoodPalette, type Color } from './palette.ts'

/** The closed set of ways a chosen color fails the universe it will be seen in. */
export const MOOD_COLOR_RISKS = ['GLARE', 'DIM', 'FAINT'] as const

export type MoodColorRisk = (typeof MOOD_COLOR_RISKS)[number]

/**
 * The risks a color carries as one mood's color. Warn-only, like the axis and near-duplicate
 * notices ([P3]) — nothing here blocks a save.
 *
 * The bands (`values.yaml`) are narrow because server-side lightness snapping pins every mood color
 * to one of three OkLCH steps: GLARE is reachable only on the top step's yellow-green arc, DIM only
 * on the bottom step's violet-magenta arc.
 *
 * A mood's own authored color is exempt, so the editor never warns about the value it ships with.
 */
export function moodColorRisks(mood: Mood, color: Color): readonly MoodColorRisk[] {
  if (color === defaultMoodPalette.colors[mood]) return []
  const luminance = relativeLuminance(color)
  const risks: MoodColorRisk[] = []
  if (luminance >= VALUES.palette.glareLuminanceMax) risks.push('GLARE')
  if (luminance <= VALUES.palette.dimLuminanceMin) risks.push('DIM')
  // Below the chroma that sorts a color into the near-neutral aggregate bucket, a color no longer
  // reads as a hue. Exempt for a mood whose authored color is itself near-neutral (NEUTRAL's warm
  // grey), read off the table rather than by name so it follows the table.
  if (colorToOkLch(color).c <= VALUES.palette.nearNeutralChromaMax && !authoredIsNeutral(mood)) {
    risks.push('FAINT')
  }
  return risks
}

function authoredIsNeutral(mood: Mood): boolean {
  return colorToOkLch(defaultMoodPalette.colors[mood]).c <= VALUES.palette.nearNeutralChromaMax
}
