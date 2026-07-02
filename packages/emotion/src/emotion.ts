import { VALUES } from '@cosimosi/config'

import { moodCoordinate, type Mood } from './mood.ts'

export interface Emotion {
  readonly mood: Mood
  readonly valence: number
  readonly arousal: number
  readonly intensity: number
}

export function createEmotion(mood: Mood, intensity = VALUES.emotion.defaultIntensity): Emotion {
  const coordinate = moodCoordinate(mood)
  return {
    mood,
    valence: coordinate.valence,
    arousal: coordinate.arousal,
    intensity,
  }
}
