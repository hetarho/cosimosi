// Public API for the memory entity (named exports only — no wildcard).
export type { Memory, StarNode, Mood } from './model/types'
export {
  activation,
  starBrightness,
  synapseBrightness,
  isDormant,
  modulatedBrightness,
  lambdaEff,
  LAMBDA,
  A_MIN,
  HALF_LIFE_DAYS,
  ALPHA_CONN,
  BETA_RECENT,
  GAMMA_EMO,
  DELTA_VAL,
} from './model/activation'
export { storageStrength, retrievalStrength, memoryR } from './model/weight'
export { seedFromId } from './model/seed'
export { reshapedBrightness, reshapedSeed } from './model/reshape'
export {
  deriveAmbient,
  ambientToRgb,
  excitabilityGain,
  rankedEmotions,
  arousalOf,
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
  selectIsPairFocus,
  selectPairFocus,
} from './model/focus.machine'
export { parseEpochMs } from './model/time'
export {
  universeQueryOptions,
  universeInvalidateKey,
  dormantQueryOptions,
  dormantInvalidateKey,
  recordsQueryOptions,
  recordsInvalidateKey,
  applyUniverse,
  refreshActivation,
  RECORD_QUERY_ROOT,
  RECORD_QUERY_DEFAULTS,
  recordQueryKey,
  fragmentTextQueryKey,
  mapStar,
  moodFromProto,
} from './api'
