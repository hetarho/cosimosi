// Public API for the evolution feature (spec 24 — 별 변천사 타임랩스). Named exports only
// (no wildcard barrel — FSD public-API rule). The page composes EvolutionPanel over the
// universe canvas and wires the recall panel's "변천사 보기" to useEvolutionStore.open.
export { EvolutionPanel } from './ui'
export { useEvolutionStore } from './model'
