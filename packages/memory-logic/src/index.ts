export { effectiveBrightness, effectiveStrength, slowFactor } from './effective-values.ts'
export {
  accessibilityCostWeight,
  decayDepth,
  decayStage,
  decayStageText,
  effectiveElapsedDays,
} from './forgetting.ts'
export { neighborForgettingDelta, reshape } from './reconsolidation.ts'
export {
  SEMANTIC_MAX_STAGE,
  gistCoordinate,
  gistUnitsElapsed,
  semanticize,
} from './semanticization.ts'
export { elapsedUniverseDays } from './universe-time.ts'
export {
  applyTemporalBonus,
  effectiveSynapseStrength,
  depress,
  downscale,
  initialStrength,
  isSignalKind,
  potentiate,
  SIGNAL_KINDS,
  type SignalKind,
} from './synapse-plasticity.ts'
