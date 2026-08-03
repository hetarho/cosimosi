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
 *
 * The mix is chosen for the BRAND, not for a story: the moods whose canonical colours sit nearest
 * the design system's primary (lavender, hue 298 — FEAR's violet, EMPTINESS's violet-grey, STRESS's
 * magenta, SAD's blue) carry most of the ramp, and the ones nearest the secondary (chartreuse, hue
 * 122 — RELIEF's spring green, CALM's teal) are the accent. The landing's sky is the product's own
 * palette wearing the product's own material. Mood names never render here — only their colours do.
 */
export const HERO_SKY_MOODS: readonly Mood[] = [
  'FEAR',
  'EMPTINESS',
  'STRESS',
  'SAD',
  'RELIEF',
  'CALM',
  'LOVE',
  'TIRED',
]

/**
 * The weight each mood holds in the ramp: the primary-adjacent violets lead (12 of 20 shares), the
 * secondary-adjacent greens answer them (4 of 20), and rose and dusty blue keep the wash from
 * reading as a two-colour gradient. None is tiny — a feeling given a sliver of the ramp is a colour
 * the fold smears away before anyone can name it.
 */
export const HERO_SKY_WEIGHTS: Readonly<Record<string, number>> = {
  FEAR: 5,
  EMPTINESS: 4,
  STRESS: 2,
  SAD: 1,
  RELIEF: 2,
  CALM: 2,
  LOVE: 2,
  TIRED: 2,
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
