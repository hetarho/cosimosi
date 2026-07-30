import { VALUES } from '@cosimosi/config'

import { moodCoordinate, type Mood } from './mood.ts'

export interface Emotion {
  readonly mood: Mood
  readonly valence: number
  readonly arousal: number
  readonly intensity: number
}

// `intensity` is annotated rather than inferred from the default: the generated VALUES table is
// `as const`, so an inferred parameter would take the literal type of `defaultIntensity` and reject
// every other number a caller passes.
export function createEmotion(
  mood: Mood,
  intensity: number = VALUES.emotion.defaultIntensity,
): Emotion {
  const coordinate = moodCoordinate(mood)
  return {
    mood,
    valence: coordinate.valence,
    arousal: coordinate.arousal,
    intensity,
  }
}
