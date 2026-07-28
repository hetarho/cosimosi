import type { Mood } from './mood.ts'
import type { Color } from './palette.ts'

// A second authored reading of the thirteen feelings, kept for one job: when the anonymous
// hue-bucket statistic has too few samples to recommend anything, a mood still needs a third
// candidate that is a real colour choice rather than an arithmetic nudge of the default.
//
// Valence-consistent like the default table (pleasant moods warm, unpleasant cool), so the
// recommendations it feeds never push a user across the [P3] axis guardrail. It is content, not a
// palette: no id, no name, registered nowhere, and nothing resolves a user's colours through it.
// `snapToEmotionStep` puts each onto the emotion lightness ladder at the point of use, so these are
// authored for hue and chroma.
export const ALTERNATIVE_MOOD_COLORS: Readonly<Record<Mood, Color>> = {
  JOY: '#f2b036',
  CALM: '#57b9a1',
  SAD: '#5dabf2',
  ANGER: '#e54479',
  FEAR: '#ab91f2',
  LOVE: '#df85a4',
  NEUTRAL: '#a8a49c',
  EXCITEMENT: '#f47d67',
  GRATITUDE: '#ffa16c',
  RELIEF: '#97d083',
  STRESS: '#b562c8',
  TIRED: '#7eadbd',
  EMPTINESS: '#9ba1cb',
}
