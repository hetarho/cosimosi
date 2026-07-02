export { createEmotion, type Emotion } from './emotion.ts'
export {
  emotionValuesKeySync,
  MOOD_QUADRANTS,
  MOODS,
  moodCoordinate,
  moodQuadrant,
  moodValueKeys,
  type EmotionQuadrant,
  type Mood,
  type MoodCoordinate,
} from './mood.ts'
export {
  defaultMoodPalette,
  defineMoodPalette,
  moodColor,
  resetMoodPalette,
  resolvePalette,
  setMoodPalette,
  type Color,
  type MoodPalette,
} from './palette.ts'
export { arousalToInitialStrength } from './strength.ts'
