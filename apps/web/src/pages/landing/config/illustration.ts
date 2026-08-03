import type { Mood } from '@cosimosi/emotion'

/**
 * The hero sky's authored ramp — invented moods in invented proportions, never anyone's data.
 *
 * Presentation content, like a theme table: it is here rather than in the tuning values because
 * there is no right answer to converge on. What it has to be is *representative* — a spread of
 * ordinary feelings in unequal amounts, so the empty sky reads as a lived-in one rather than a
 * gradient someone picked.
 *
 * Eight of them rather than a handful, because a feeling's weight buys it AREA in the ramp: the more
 * feelings the ramp carries, the more distinct places the sky is divided into, and the more of the
 * palette drifts past a visitor who only stays a moment.
 */
export const HERO_SKY_MOODS: readonly Mood[] = [
  'CALM',
  'GRATITUDE',
  'LOVE',
  'JOY',
  'EXCITEMENT',
  'TIRED',
  'STRESS',
  'SAD',
]

/**
 * The weight each mood holds in the ramp. `CALM` and `GRATITUDE` still lead, so the first sky a
 * visitor sees leans the way the walkthrough later explains: towards what is returned to, not a flat
 * average. The rest are deliberately not tiny — a feeling given a sliver of the ramp is a colour the
 * fold smears away before anyone can name it.
 */
export const HERO_SKY_WEIGHTS: Readonly<Record<string, number>> = {
  CALM: 5,
  GRATITUDE: 4,
  LOVE: 3,
  JOY: 3,
  EXCITEMENT: 2,
  TIRED: 2,
  STRESS: 2,
  SAD: 1,
}

/**
 * How much faster than the product's own sky the hero's runs — the sky's seconds uniform, multiplied.
 *
 * The product's pace is tuned for a place you live in, where the sky moving is something you notice
 * over a session. The hero has one: a visitor is here for a few seconds, and at 1× the wash is a still
 * image to them. This is the ONLY thing the landing accelerates, and it accelerates a drift, not a
 * mechanic — nothing about a memory, a strength or a decay is read from this number.
 */
export const HERO_SKY_RATE = 2.5
