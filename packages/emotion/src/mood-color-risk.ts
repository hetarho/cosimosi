import { VALUES } from '@cosimosi/config'

import { relativeLuminance } from './gamut.ts'
import { nearDuplicateMood } from './mood-color.ts'
import type { Mood } from './mood.ts'
import { colorToOkLch } from './oklab.ts'
import { defaultMoodPalette, type Color } from './palette.ts'

/** The closed set of ways a chosen color fails the universe it will be seen in. */
export const MOOD_COLOR_RISKS = ['GLARE', 'DIM', 'FAINT', 'SIMILAR'] as const

export type MoodColorRisk = (typeof MOOD_COLOR_RISKS)[number]

/** A risk, and — for the ones about another feeling — which feeling it is about. */
export interface MoodColorConcern {
  readonly risk: MoodColorRisk
  /** The other mood a SIMILAR concern is about; absent for every risk about the color alone. */
  readonly otherMood?: Mood
}

/**
 * The risks a color carries as one mood's color. Warn-only, like the axis notice ([P3]) — nothing
 * here blocks a save.
 *
 * Three of the four are about the color ALONE, and their bands (`values.yaml`) are narrow because
 * server-side lightness snapping pins every mood color to one of three OkLCH steps: GLARE is
 * reachable only on the top step's yellow-green arc, DIM only on the bottom step's violet-magenta
 * arc, FAINT below the chroma at which a color stops reading as a hue at all.
 *
 * SIMILAR is the fourth and the only relational one: it is about this color against the twelve
 * OTHERS, so it needs them passed in. It is raised HERE, beside the rest, rather than as a notice of
 * its own after a save — a reader deserves to know two feelings will be hard to tell apart while
 * they are still choosing, and one list of concerns is one thing to read instead of two.
 *
 * A mood's own authored color is exempt from the three about the color alone, so the editor never
 * warns about the value it ships with — but NOT from SIMILAR: the authored color of one feeling can
 * still land next to a color the reader chose for another, and staying quiet about that would be the
 * product defending its default over what the reader can see.
 */
export function moodColorRisks(
  mood: Mood,
  color: Color,
  otherColors: Readonly<Partial<Record<Mood, Color>>> = {},
): readonly MoodColorConcern[] {
  const risks: MoodColorConcern[] = []
  if (color !== defaultMoodPalette.colors[mood]) {
    const luminance = relativeLuminance(color)
    if (luminance >= VALUES.palette.glareLuminanceMax) risks.push({ risk: 'GLARE' })
    if (luminance <= VALUES.palette.dimLuminanceMin) risks.push({ risk: 'DIM' })
    // Below the chroma that sorts a color into the near-neutral aggregate bucket, a color no longer
    // reads as a hue. Exempt for a mood whose authored color is itself near-neutral (NEUTRAL's warm
    // grey), read off the table rather than by name so it follows the table.
    if (colorToOkLch(color).c <= VALUES.palette.nearNeutralChromaMax && !authoredIsNeutral(mood)) {
      risks.push({ risk: 'FAINT' })
    }
  }
  // The mood being edited is skipped even when it is present in the table: a color is never too close
  // to the color it is replacing.
  const otherMood = nearDuplicateMood(color, otherColors, mood)
  if (otherMood) risks.push({ risk: 'SIMILAR', otherMood })
  return risks
}

function authoredIsNeutral(mood: Mood): boolean {
  return colorToOkLch(defaultMoodPalette.colors[mood]).c <= VALUES.palette.nearNeutralChromaMax
}
