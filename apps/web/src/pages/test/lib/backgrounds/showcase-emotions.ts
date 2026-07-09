import type { Mood } from '@cosimosi/emotion'

import { toEmotionSlices, type EmotionSlice } from './emotion-field.ts'

// Fixed emotion sets for the showcase: the same effect is shown holding 1, 3, 5 and 7 emotions so
// the designer can read how each backdrop subdivides as a universe accrues more feeling. The moods
// are ordered warm→cool for visually distinct, primary-first swatches; shares descend gently so the
// weight-driven structure (band width / blob area / ring thickness) is visible rather than uniform.

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

/** The emotion counts shown side-by-side in the showcase. */
export const SHOWCASE_EMOTION_COUNTS = [1, 3, 5, 7] as const

/** Build `count` primary-first emotion slices with gently descending shares. */
export function showcaseEmotions(count: number): EmotionSlice[] {
  const n = Math.max(0, Math.min(count, SHOWCASE_MOOD_ORDER.length))
  const raw = new Map<Mood, number>()
  for (let i = 0; i < n; i++) {
    const mood = SHOWCASE_MOOD_ORDER[i]
    if (mood) raw.set(mood, n - i * 0.6)
  }
  return toEmotionSlices(raw)
}
