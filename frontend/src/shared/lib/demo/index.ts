// Public API for the demo("체험") module — 명시 export만(FSD 공개 API 규칙).
export {
  isDemoMode,
  enterDemoMode,
  exitDemoMode,
  setDemoModeListener,
  getDemoPersona,
  setDemoPersona,
  getDemoFlow,
  setDemoFlow,
  getTutorialStep,
  setTutorialStep,
  enterTutorialMode,
  completeTutorial,
  restartTutorial,
  type DemoPersona,
  type DemoFlow,
} from './flag'
export { demoPersonaList, type DemoPersonaMeta } from './personas'
export {
  demoStars,
  demoSynapses,
  demoRecall,
  demoFragmentText,
  demoListRecords,
  demoGetRecord,
  demoAddRandomStars,
  demoToday,
  demoMarkRecalled,
  demoReshape,
  demoApplyDayBatch,
  demoEvolution,
  demoOverlayData,
  resetDemo,
} from './data'
export type { EvolutionSnap, DemoOverlaySide } from './data'
export { startDemoSession } from './session'
export { useDemoOverlay } from './overlay-mode'
export { virtualNowMs, demoOffsetDays } from './clock'
