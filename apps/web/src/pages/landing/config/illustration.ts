import type { Mood } from '@cosimosi/emotion'

/**
 * The hero sky's authored ramp — invented moods in invented proportions, never anyone's data.
 *
 * Presentation content, like a theme table: it is here rather than in the tuning values because
 * there is no right answer to converge on. What it has to be is *representative* — a handful of
 * ordinary feelings in unequal amounts, so the empty sky reads as a lived-in one rather than a
 * gradient someone picked.
 */
export const HERO_SKY_MOODS: readonly Mood[] = ['CALM', 'JOY', 'TIRED', 'GRATITUDE', 'STRESS']

/**
 * The weight each mood holds in the ramp. `CALM` and `GRATITUDE` lead, so the first sky a visitor
 * sees already leans the way the walkthrough later explains: towards what is returned to, not a
 * flat average.
 */
export const HERO_SKY_WEIGHTS: Readonly<Record<string, number>> = {
  CALM: 5,
  JOY: 2,
  TIRED: 1,
  GRATITUDE: 4,
  STRESS: 1,
}
