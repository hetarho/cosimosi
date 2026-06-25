export { VALUES } from './values.gen' // GENERATED from spec/values.yaml (balance-patch source)
export {
  type Axis,
  itemId,
  subItemIds,
  isFree,
  priceOf,
  isOwned,
} from './customization' // 커스터마이즈 경제 순수 헬퍼(spec 44·52)
export { type CosmosPalette, DEFAULT_PALETTE } from './cosmos' // 배경 팔레트 순수 shape(spec 43·44)
export {
  ABSTRACTION_STAGE_MAX,
  abstractionLabel,
  abstractionGauge,
} from './abstraction' // 추상화 단계 라벨·점 게이지(change 32)
export { MOOD, type MoodKey } from './palette'
export {
  MOOD_PALETTE,
  MOOD_LABEL,
  MOODS,
  MOOD_AFFECT,
  MOODS_BY_QUADRANT,
  NEUTRAL_RGB,
  moodRgb,
  moodLabel,
  resolveMoodRgb,
  rgbToHex,
  type Mood,
  type RGB,
  type Affect,
  type Quadrant,
} from './mood'
