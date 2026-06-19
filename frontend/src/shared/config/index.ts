export { VALUES } from './values.gen' // GENERATED from spec/values.yaml (balance-patch source)
export {
  type Axis,
  itemId,
  isFree,
  priceOf,
  isKnownItem,
  isOwned,
} from './customization' // 커스터마이즈 경제 순수 헬퍼(spec 44)
export { type CosmosPalette, DEFAULT_PALETTE } from './cosmos' // 배경 팔레트 순수 shape(spec 43·44)
export { MOOD, MOOD_KEYS, SPACE, type MoodKey } from './palette'
export {
  MOOD_PALETTE,
  MOOD_LABEL,
  MOODS,
  MOOD_AFFECT,
  NEUTRAL_RGB,
  moodRgb,
  moodLabel,
  hexToRgb,
  resolveMoodRgb,
  type Mood,
  type RGB,
  type Affect,
  type Quadrant,
} from './mood'
