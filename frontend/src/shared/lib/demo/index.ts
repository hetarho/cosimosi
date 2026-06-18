// Public API for the demo("체험") module — 명시 export만(FSD 공개 API 규칙).
export {
  isDemoMode,
  enterDemoMode,
  exitDemoMode,
  setDemoModeListener,
  getDemoPersona,
  setDemoPersona,
  type DemoPersona,
} from './flag'
export { demoPersonaList, type DemoPersonaMeta } from './personas'
export {
  demoStars,
  demoSynapses,
  demoRecall,
  demoFragmentText,
  demoListRecords,
  demoAddRecord,
  demoAddStar,
  demoAddMultiSceneStar,
  demoToday,
  demoMarkRecalled,
  demoReshape,
  demoConsolidate,
  demoApplyDayBatch,
  demoEvolution,
  demoOverlayData,
  resetDemo,
} from './data'
export type { EvolutionSnap, DemoOverlaySide } from './data'
export { useDemoOverlay } from './overlay-mode'
export { virtualNowMs, skipDemoDays, demoOffsetDays, resetDemoClock } from './clock'
export { brightestStarId, thickestEdge, sameDayPair, dormantStarId } from './observe'
