import type { Mood } from '@cosimosi/emotion'

/**
 * Authored illustration for the page — invented moods in invented proportions, never anyone's data.
 *
 * Presentation content, like a theme table: it is here rather than in the tuning values because there is
 * no right answer to converge on. What it has to be is *representative* — a handful of ordinary feelings
 * in unequal amounts, so the mirror section has something honest to compare.
 */

/** A week's worth of imaginary entries: the same set for both halves of the mirror comparison. */
export const ILLUSTRATIVE_MOODS: readonly Mood[] = ['CALM', 'JOY', 'TIRED', 'GRATITUDE', 'STRESS']

/**
 * How often each of them was returned to. `CALM` and `GRATITUDE` are the ones this imaginary person
 * re-read, which is exactly what makes the two swatch rows differ — and what the definition beside them
 * is about. The averaged row weights all five equally.
 */
export const ILLUSTRATIVE_REVISIT_WEIGHTS: Readonly<Record<string, number>> = {
  CALM: 5,
  JOY: 2,
  TIRED: 1,
  GRATITUDE: 4,
  STRESS: 1,
}

/**
 * The hero's sky. Weighted rather than flat, because the hero is showing the emotion sky of an empty
 * universe and a flat ramp would read as a gradient someone picked. These are the same illustrative
 * proportions as above, so the page tells one story.
 */
export const HERO_SKY_MOODS: readonly Mood[] = ILLUSTRATIVE_MOODS
