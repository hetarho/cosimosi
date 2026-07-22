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
  assertCompletePalette,
  defaultMoodPalette,
  defineMoodPalette,
  moodColor,
  paletteVersion,
  resetMoodPalette,
  resolvePalette,
  setMoodPalette,
  subscribeMoodPalette,
  type Color,
  type MoodPalette,
} from './palette.ts'
export {
  DEFAULT_PALETTE_ID,
  PALETTES,
  listPalettes,
  paletteById,
  paletteIds,
  resolvePaletteById,
  type ResolvedMoodPalette,
} from './registry.ts'
export {
  MAX_SHOWCASE_EMOTIONS,
  showcaseEmotions,
  toEmotionSlices,
  type EmotionSlice,
} from './slices.ts'
export { checkPaletteAxisConsistency, type PaletteAxisWarning } from './axis-consistency.ts'
export { arousalToInitialStrength } from './strength.ts'
