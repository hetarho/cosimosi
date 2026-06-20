// Public API for the appearance entity — 유저가 고른 4축 시각 선호(spec 44). 별 종류(StarObject)·시냅스
// 스타일(SynapseStyle)은 각 entity 소유 — 여기선 store가 그 '선택'만 운반한다. 배경(Background)은 여기 소유.
export type {
  Background,
  BackgroundMeta,
  BackgroundTexture,
  BackgroundPattern,
  BackgroundEffect,
  SelfObject,
  SelfObjectMeta,
} from './model/types'
// 정명(Background) + 옛 이름(Theme) alias — 점진 정리용.
export type { Theme, ThemeMeta } from './model/types'
export {
  BACKGROUNDS,
  DEFAULT_BACKGROUND,
  backgroundMeta,
  paletteForBackground,
  themeAccent,
  themeBg,
  // 옛 이름 alias.
  THEMES,
  DEFAULT_THEME,
} from './model/backgrounds'
export { SELF_OBJECTS, DEFAULT_SELF_OBJECT } from './model/self-objects'
// 자아 별 형태 TSL 빌더(spec 38·44) — 우주 캔버스·플레이그라운드 미리보기 공용(buildStarBody 동형).
export { buildSelfForm, type SelfFormBuild } from './ui/self-form'
export { useAppearance, type ServerInventory } from './model/store'
export {
  settingsQueryOptions,
  applySettings,
  pushSettings,
  // 커스터마이즈 인벤토리·구매 데이터 계층(spec 44).
  inventoryQueryOptions,
  applyInventory,
  purchaseItem,
  // 감정색 온보딩(spec 45) — 완료 판정·일괄 저장·draft 시드.
  isEmotionColorComplete,
  emotionColorsOf,
  saveEmotionColors,
} from './api/settings-query'
// 감정색 순수 helper(spec 45) — 추천 팔레트·완료 판정·draft 병합·hex 정규화.
export {
  MOOD_ORDER,
  recommendedEmotionColors,
  isCompleteEmotionColors,
  mergeEmotionColorDraft,
  rgbToHex,
  normalizeHex,
  isHexColor,
} from './model/emotion-colors'
