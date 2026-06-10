// Public API for the demo("체험") module — 명시 export만(FSD 공개 API 규칙).
export { isDemoMode, enterDemoMode, exitDemoMode, setDemoModeListener } from './flag'
export { demoStars, demoSynapses, demoRecall, demoAddRecord, resetDemo } from './data'
