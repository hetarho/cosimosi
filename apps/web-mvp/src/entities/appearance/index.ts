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
  SelfSkinMeta,
} from './model/types'
// Theme is a legacy type alias kept while store state still names the background field `theme`.
export type { Theme } from './model/types'
export {
  BACKGROUNDS,
  backgroundMeta,
  isBackground,
  paletteForBackground,
  parseBackground,
  themeAccent,
} from './model/backgrounds'
export { SELF_OBJECTS, isSelfObject, parseSelfObject } from './model/self-objects'
// 자아 형태×표면 2축 스킨(spec 52) — 카탈로그·디컴포지션·합성 인코딩.
export {
  type SelfForm,
  type SelfSurface,
  type SelfSelection,
  SELF_FORMS,
  SELF_SURFACES,
  SELF_PRESETS,
  DEFAULT_SELF_FORM,
  DEFAULT_SELF_SURFACE,
  DEFAULT_SELF_SELECTION,
  parseSelfForm,
  parseSelfSurface,
  encodeSelfSelection,
  decodeSelfSelection,
  normalizeSelfSelection,
} from './model/self-forms'
// 자아 별 형태×표면 TSL 빌더(spec 38·44·52) — 우주 캔버스·플레이그라운드 미리보기 공용(buildStarBody 동형).
export { buildSelfForm, type SelfFormBuild, SELF_FORM_BUILDERS, SELF_SURFACE_BUILDERS } from './ui/self-form'
// 배경 스킨 조립 registry(spec 51) — shared 툴킷 조합으로 효과별 색 노드 생성. UniverseNebula 셸이 N-제네릭 소비.
export { BACKGROUND_FORMS, type BackgroundForm, type BackgroundFieldContext } from './ui/background-form'
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
  emotionFormsOf,
  saveEmotionColors,
} from './api/settings-query'
// 감정색 순수 helper(spec 45) — 추천 팔레트·완료 판정·draft 병합·hex 정규화.
export {
  MOOD_ORDER,
  recommendedEmotionColors,
  mergeEmotionColorDraft,
  normalizeHex,
} from './model/emotion-colors'
