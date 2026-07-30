// @cosimosi/demo — the shipped content the signed-out demo runs on: three neuron-overlapping
// diary sets with their splits, gist ladders and word-loss texts fully precomputed, the scenario
// that names the ten beats, and the resolver that hands the real read models production shapes.
//
// Pure and IO-free: no clock, no randomness, no storage, no network, no DB, no LLM port ([Z1][Z5]).
// It re-implements NO domain function — every derived value the demo shows comes from the existing
// golden-pinned mirrors in @cosimosi/memory-logic and @cosimosi/emotion — a second copy of a formula
// would be a demo-only RULE, which is the first crack in the [I13] isolation boundary.
export type {
  DemoActivation,
  DemoDiary,
  DemoDiarySet,
  DemoDiarySetStructure,
  DemoDiarySetText,
  DemoDiaryText,
  DemoDiaryTriple,
  DemoMemory,
  DemoMemoryText,
  DemoNeuron,
  DemoSynapse,
} from './diary-set.ts'
export {
  DEMO_BEAT_IDS,
  type DemoBeatId,
  type DemoOrnamentTaste,
  type DemoScenario,
} from './scenario.ts'
export { DEMO_DIARY_SETS } from './diary-sets/index.ts'
export { pickDemoDiarySet } from './pick.ts'
export {
  demoBaseStrength,
  resolveDemoDiarySet,
  resolveDemoEpoch,
  type DemoGistTexts,
  type ResolvedDemoDiarySet,
} from './resolve.ts'
