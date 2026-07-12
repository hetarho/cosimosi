// @cosimosi/universe — the pure, cross-app core of the universe write + render vertical: the
// domain→force-sim graph projection, the sim-host bridge, the camera/selection + writing-flow
// XState machines, the domain→visual channel projections, the read-model stores, and the
// launch/awaken logic. Free of three/DOM/native by rule; web and mobile import it verbatim and
// keep only their platform forks (worker spawner, canvas host, DOM/RN sheets). The R3F bindings
// that consume these live in @cosimosi/universe-render.
export { buildUniverseGraph, buildSynapseEndpointIndexPairs } from './build-graph.ts'
export {
  createUniverseSimBridge,
  type UniverseSimBridge,
  type MutableCoordinateBufferRef,
  type SimWorkerLike,
  type SimWorkerSpawner,
  type SimWorkerRequest,
  type SimWorkerResponse,
} from './sim-bridge.ts'
export {
  universeNavigationMachine,
  type UniverseNavigationContext,
  type UniverseNavigationEvent,
  type UniverseNavigationMode,
} from './universe-navigation.machine.ts'
export { UNIVERSE_CAMERA_RIG } from './camera-rig.ts'

// Write-vertical control-state + proposal algebra
export {
  writingFlowMachine,
  type WritingFlowStatus,
  type WritingFlowContext,
  type WritingFlowEvent,
} from './writing-flow.machine.ts'
export {
  starDetailMachine,
  resolveSelection,
  type StarDetailPhase,
  type StarDetailEvent,
  type ResolvedSelection,
  type SelectionStores,
} from './star-detail.machine.ts'
export {
  recallFlowMachine,
  recallOutcome,
  type RecallFlowPhase,
  type RecallFlowEvent,
  type RecallOutcome,
} from './recall-flow.machine.ts'
export {
  requestRecall,
  applyRecallResult,
  recallAdvanceAnnouncement,
  type RecallInput,
} from './recall-star.ts'
export { useRecallTargetStore, type RecallTargetState } from './recall-target-store.ts'
export {
  draftsFromResponse,
  renameMemory,
  setMemoryMood,
  mergeMemory,
  splitMemory,
  type ProposedMemoryDraft,
  type ProposedNeuronDraft,
} from './proposal.ts'
export {
  requestLaunchStars,
  insertLaunchedMemories,
  isPastDated,
  type ConfirmedMemoryInput,
  type LaunchStarsInput,
} from './launch-stars.ts'

// Universe time presentation core: the clock mirror, the advance interval an acceleration plays
// over, and the time overlay's control-state
export {
  useUniverseClockStore,
  type UniverseClock,
  type UniverseClockState,
} from './universe-clock-store.ts'
export {
  UNIVERSE_TIME_ACCELERATION,
  advanceAnnouncementFromLaunch,
  advanceDurationMs,
  advanceSweepFrame,
  isEmptyAdvance,
  mergeAdvanceAnnouncements,
  sampleAdvanceDate,
  type AdvanceAnnouncement,
  type AdvanceInterval,
  type AdvanceSweepFrame,
} from './advance-interval.ts'
export {
  universeTimeMachine,
  type UniverseTimeEvent,
  type UniverseTimePhase,
} from './universe-time.machine.ts'

// Awaken (entry choreography) logic + idempotency registry
export {
  pickAwakenSeeds,
  recentlyActiveNeuronIds,
  type AwakenAnchor,
  type AwakenSeedInput,
  type RecentlyActiveInput,
  type RecentMemory,
} from './pick-awaken-seed.ts'
export { useAwakenRegistryStore, type AwakenRegistryState } from './awaken-registry.ts'

// Latent field (decorative gray engram scatter) + its consumed-marks store
export { generateLatentField, type LatentField, type LatentFieldParams } from './latent-field.ts'
export { useLatentConsumedStore, type LatentConsumedState } from './latent-consumed-store.ts'

// Domain → visual channel projections (one-way, §3.4)
export { starChannels, hexToLinearRgb, normalizeSeed, type StarChannels } from './star-channels.ts'
export { currentDecayStage, currentDecayText } from './current-decay-text.ts'
export { cellStarChannels, type CellStarChannels } from './cell-star-channels.ts'
export {
  filamentChannels,
  projectFilaments,
  type FilamentChannels,
  type FilamentBatch,
} from './filament-channels.ts'
export {
  buildContributors,
  type NebulaContributors,
  type ContributorParams,
} from './contributors.ts'

// Read-model stores (data, §3.2) — populated per GetUniverse read, read by the render bindings
export { useEpisodicMemoryStore, type EpisodicMemoryState } from './episodic-memory-store.ts'
export { useNeuronStore, type NeuronState } from './neuron-store.ts'
export { useSynapseStore, type SynapseState } from './synapse-store.ts'
