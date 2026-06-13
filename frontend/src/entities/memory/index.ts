// Public API for the memory entity (named exports only — no wildcard).
export type { Memory, StarNode, Mood } from './model/types'
export {
  activation,
  starBrightness,
  synapseBrightness,
  isDormant,
  LAMBDA,
  A_MIN,
  HALF_LIFE_DAYS,
} from './model/activation'
export { seedFromId } from './model/seed'
export { reshapedBrightness, reshapedSeed } from './model/reshape'
export { useMemoryStore } from './model/store'
export { parseEpochMs } from './model/time'
export {
  universeQueryOptions,
  universeInvalidateKey,
  dormantQueryOptions,
  dormantInvalidateKey,
  applyUniverse,
  refreshActivation,
  RECORD_QUERY_ROOT,
  RECORD_QUERY_DEFAULTS,
  recordQueryKey,
  mapStar,
  moodFromProto,
} from './api'
