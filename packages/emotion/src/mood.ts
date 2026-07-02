import { VALUES } from '@cosimosi/config'

export const MOODS = [
  'JOY',
  'CALM',
  'SAD',
  'ANGER',
  'FEAR',
  'LOVE',
  'NEUTRAL',
  'EXCITEMENT',
  'GRATITUDE',
  'RELIEF',
  'STRESS',
  'TIRED',
  'EMPTINESS',
] as const

export type Mood = (typeof MOODS)[number]

export type EmotionQuadrant =
  | 'positive_high_arousal'
  | 'positive_low_arousal'
  | 'negative_high_arousal'
  | 'negative_low_arousal'
  | 'neutral'

type ValuesMoodValenceKey = Extract<keyof typeof VALUES.emotion.moodValence, string>
type ValuesMoodArousalKey = Extract<keyof typeof VALUES.emotion.moodArousal, string>

export const moodValueKeys = {
  JOY: 'joy',
  CALM: 'calm',
  SAD: 'sad',
  ANGER: 'anger',
  FEAR: 'fear',
  LOVE: 'love',
  NEUTRAL: 'neutral',
  EXCITEMENT: 'excitement',
  GRATITUDE: 'gratitude',
  RELIEF: 'relief',
  STRESS: 'stress',
  TIRED: 'tired',
  EMPTINESS: 'emptiness',
} as const satisfies Record<Mood, ValuesMoodValenceKey & ValuesMoodArousalKey>

type MoodValueKey = (typeof moodValueKeys)[Mood]
type ExactKeys<Expected extends string, Actual extends string> = [
  Exclude<Expected, Actual>,
  Exclude<Actual, Expected>,
] extends [never, never]
  ? true
  : never

export const emotionValuesKeySync: ExactKeys<MoodValueKey, ValuesMoodValenceKey> &
  ExactKeys<MoodValueKey, ValuesMoodArousalKey> = true

export const MOOD_QUADRANTS = {
  JOY: 'positive_high_arousal',
  EXCITEMENT: 'positive_high_arousal',
  LOVE: 'positive_high_arousal',
  CALM: 'positive_low_arousal',
  GRATITUDE: 'positive_low_arousal',
  RELIEF: 'positive_low_arousal',
  ANGER: 'negative_high_arousal',
  FEAR: 'negative_high_arousal',
  STRESS: 'negative_high_arousal',
  SAD: 'negative_low_arousal',
  TIRED: 'negative_low_arousal',
  EMPTINESS: 'negative_low_arousal',
  NEUTRAL: 'neutral',
} as const satisfies Record<Mood, EmotionQuadrant>

export interface MoodCoordinate {
  readonly valence: number
  readonly arousal: number
}

export function moodQuadrant(mood: Mood): EmotionQuadrant {
  return MOOD_QUADRANTS[mood]
}

export function moodCoordinate(mood: Mood): MoodCoordinate {
  const key = moodValueKeys[mood]
  return {
    valence: VALUES.emotion.moodValence[key],
    arousal: VALUES.emotion.moodArousal[key],
  }
}
