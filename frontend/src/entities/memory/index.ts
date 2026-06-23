// Public API for the memory entity (named exports only — no wildcard).
export type { Memory, StarNode, Mood } from './model/types'
export { starBrightness, isDormant, A_MIN } from './model/activation'
export { memoryR, memoryRadiusR, radiusConnectedness } from './model/weight'
export { seedFromId, seedComponents } from './model/seed'
export { reshapedSeed, reshapedShapeSeed } from './model/reshape'
export {
  deriveAmbient,
  ambientToRgb,
  rankedEmotions,
  arousalOf,
  excitabilityGain,
  type Ambient,
  type AmbientStar,
  type RankedEmotion,
} from './model/ambient'
export { useMemoryStore, starsOfRecord } from './model/store'
// 포커스 머신(구 memory.selectedId + wayfinding.highlightedRecordId/frameRequest의 단일 출처).
export {
  focusActor,
  selectFocusedStarId,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsDiaryFocus,
  selectIsFocused,
  selectFrameNonce,
  selectPairFocus,
} from './model/focus.machine'
export { parseEpochMs } from './model/time'
export {
  universeQueryOptions,
  universeInvalidateKey,
  dormantInvalidateKey,
  recordsQueryOptions,
  recordsInvalidateKey,
  recordDetailQueryOptions,
  applyUniverse,
  refreshActivation,
  RECORD_QUERY_ROOT,
  RECORD_QUERY_DEFAULTS,
  recordQueryKey,
  fragmentTextQueryKey,
  mapStar,
  moodFromProto,
} from './api'
