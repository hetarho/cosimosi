import { moodColor, type Mood } from '@cosimosi/emotion'

// The emotion set a backdrop carries — the *emotions present in the universe*, not the theme. Each
// slice is a mood, its palette color, and a normalized share; a backdrop paints them so the more
// emotions a universe holds, the more the sky divides among them. Presentation-only. (This is the
// generic slice model shared by the sky test panels — the emotion-sky effects themselves live in
// `@cosimosi/3d-renderer` and consume the palette ramp.)

/** One emotion present in the universe, with its share of the field. Weights sum to 1. */
export interface EmotionSlice {
  readonly mood: Mood
  /** The mood's palette color (hex from `moodColor`). */
  readonly color: string
  /** Normalized share of the field, 0..1; the sum over all slices is 1. */
  readonly weight: number
}

/**
 * Build normalized, primary-first slices from moods carrying raw (unnormalized) weights.
 * Zero/negative weights drop out; an empty or all-zero map yields no slices.
 */
export function toEmotionSlices(rawWeights: ReadonlyMap<Mood, number>): EmotionSlice[] {
  const entries = [...rawWeights.entries()].filter(([, weight]) => weight > 0)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (total <= 0) return []
  return entries
    .map(([mood, weight]) => ({ mood, color: moodColor(mood), weight: weight / total }))
    .sort((a, b) => b.weight - a.weight || a.mood.localeCompare(b.mood))
}

// Fixed emotion sets for the sky showcase: the same effect is shown holding 1, 3, 5 and 7 emotions
// so the designer can read how each backdrop subdivides as a universe accrues more feeling. The
// moods are ordered warm→cool for visually distinct, primary-first swatches; shares descend
// GEOMETRICALLY (each ~0.7× the one before) so the weight-driven structure reads the way a real
// universe would — the primary claims the widest, deepest band and the tail sinks to a faint wash,
// not a near-uniform ramp that hides the priority fade. Tune SHOWCASE_FALLOFF to taste.

const SHOWCASE_MOOD_ORDER: readonly Mood[] = [
  'JOY',
  'LOVE',
  'CALM',
  'FEAR',
  'EXCITEMENT',
  'SAD',
  'RELIEF',
  'ANGER',
  'GRATITUDE',
  'STRESS',
  'TIRED',
  'NEUTRAL',
  'EMPTINESS',
]

/** The most emotions the showcase can hold (the full mood order) — the panel's count ceiling. */
export const MAX_SHOWCASE_EMOTIONS = SHOWCASE_MOOD_ORDER.length

/** Each successive emotion holds this fraction of the previous one's raw weight. */
const SHOWCASE_FALLOFF = 0.7

/** Build `count` primary-first emotion slices with geometrically descending shares. */
export function showcaseEmotions(count: number): EmotionSlice[] {
  const n = Math.max(0, Math.min(count, SHOWCASE_MOOD_ORDER.length))
  const raw = new Map<Mood, number>()
  for (let i = 0; i < n; i++) {
    const mood = SHOWCASE_MOOD_ORDER[i]
    if (mood) raw.set(mood, SHOWCASE_FALLOFF ** i)
  }
  return toEmotionSlices(raw)
}
