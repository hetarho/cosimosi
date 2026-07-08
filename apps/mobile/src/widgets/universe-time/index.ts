export { UniverseTimeOverlay } from './ui/UniverseTimeOverlay.tsx'
// The "open sync consent" affordance reserved for the recall flow ([R1a]): await the decision,
// then compose the Recall whose committed interval this overlay plays.
export { requestTimeSyncConsent, type TimeSyncDecision } from '../../features/confirm-time-sync/index.ts'
