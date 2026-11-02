// @cosimosi/universe — the pure, cross-app core of the universe write + render vertical: the
// domain→force-sim graph projection, the sim-host bridge, the camera/selection XState machine,
// the domain→visual channel projections, the read-model stores, and the
// launch/awaken logic. Free of three/DOM/native by rule; web and mobile import it verbatim and
// keep only their platform forks (worker spawner, canvas host, DOM/RN sheets). The R3F bindings
// that consume these live in @cosimosi/universe-render.
export { buildUniverseGraph, buildSynapseEndpointIndexPairs } from './build-graph.ts'
export {
  createUniverseSimBridge,
  coordinatesMovedBeyond,
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
export {
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
  UNIVERSE_CAMERA_RIG,
} from './camera-rig.ts'
export {
  UNIVERSE_DEFAULT_VIEW_MODE,
  useUniverseViewStore,
  type UniverseViewMode,
  type UniverseViewState,
} from './universe-view-store.ts'

// Write-vertical statuses + selection; the flow machines and their requests sit behind the
// ./react/flows controllers.
export { type WritingFlowStatus } from './writing-flow.machine.ts'
export {
  starDetailMachine,
  resolveSelection,
  type StarDetailPhase,
  type StarDetailEvent,
  type ResolvedSelection,
  type SelectionStores,
} from './star-detail.machine.ts'
export { type RecallOutcome } from './recall-flow.machine.ts'
export { useRecallTargetStore, type RecallTargetState } from './recall-target-store.ts'

// The client operation id a paid request carries; the paid session itself lives in the controllers.
export { newOperationId } from './paid-action-session.ts'

// Diary-reader vertical (일기장, [D2][D3]): the free archive read-model and the two cross-route
// one-slot channels (deep-link into the reader, camera fly back out).
export { useDiaryStore, type DiaryState } from './diary-store.ts'
export type { Diary, DiaryDay, DiaryDayMood, DiarySplitMember } from '@cosimosi/memory'
// The calendar's pure month/mark projection ([D12]) — string dates + integer arithmetic only, no color.
export {
  buildMonthGrid,
  dayRepresentativeMood,
  monthDateRange,
  monthMarks,
  resolveCalendarMonth,
  stepMonth,
  type DayMark,
  type MonthCell,
} from './diary-calendar.ts'
export { useOpenDiaryTargetStore, type OpenDiaryTargetState } from './open-diary-target-store.ts'
export { useDiaryDraftStore, type DiaryDraftState } from './diary-draft-store.ts'

// Deletion + letting-go vertical: the restore-window helper and the three cross-route stores
// (open-target, same-session released groups, optimistic seal marks).
export { remainingRestoreDays } from './deletion-flow.machine.ts'
export {
  useDeletionTargetStore,
  type DeletionTarget,
  type DeletionTargetState,
} from './deletion-target-store.ts'
export {
  useReleasedGroupsStore,
  type ReleasedGroup,
  type ReleasedGroupsState,
} from './released-groups-store.ts'
export { type DeletionCandidate } from './deletion-draft-store.ts'
export { usePendingFlyTargetStore, type PendingFlyTargetState } from './pending-fly-target-store.ts'
export {
  SPOTLIGHT_FADE_LAMBDA,
  SPOTLIGHT_HOLD_SECONDS,
  SPOTLIGHT_SCENE_DIM,
  SPOTLIGHT_STAR_LIFT,
  useSpotlightStore,
  type SpotlightState,
} from './spotlight-store.ts'
export { renameMemory, setMemoryMood, mergeMemory, splitMemory } from './proposal.ts'
export { isPastDated } from './launch-stars.ts'

// Universe time presentation core: the clock mirror, the advance interval an acceleration plays
// over, and the consent and sweep stores the time overlay reads
export {
  useUniverseClockStore,
  type UniverseClock,
  type UniverseClockState,
} from './universe-clock-store.ts'
export {
  UNIVERSE_TIME_ACCELERATION,
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
  useAdvanceAnnouncementStore,
  type AdvanceAnnouncementState,
} from './advance-announcement-store.ts'
export {
  ADVANCE_SKY_PEAK_RATE,
  advanceSkyRate,
  advanceSkyRateFor,
  resetAdvanceSkyRate,
  useAdvanceSweepStore,
  type AdvanceSweepState,
} from './advance-sweep-store.ts'
export {
  cancelPendingTimeSyncConsent,
  requestTimeSyncConsent,
  useTimeSyncConsentStore,
  type TimeSyncConsentState,
  type TimeSyncDecision,
} from './time-sync-consent-store.ts'
export { useLaunchedNeuronsStore, type LaunchedNeuronsState } from './launched-neurons-store.ts'
export { releaseAdvance } from './release-advance.ts'
export { syncUniverseClock } from './sync-universe-clock.ts'

// Stardust economy control-state; the Twinkle data/IO package owns balances and charge requests.

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
export {
  currentDecayStage,
  currentDecaySpans,
  currentDecayText,
  type DecayTextSpan,
} from './current-decay-text.ts'
export {
  gistNodeId,
  gistStageOffset,
  gistStarInstances,
  parseGistNodeId,
  type GistStarInstance,
} from './gist-star-channels.ts'
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
export { universeEmotionSlices } from './universe-emotion-slices.ts'
export {
  GIST_SHAPE_STAR_MAGNIFICATION,
  SHOWCASE_ELAPSED_DAYS,
  SHOWCASE_UNIVERSE_TIME,
  ambientShowcaseScene,
  awakenShowcaseField,
  forgettingShowcaseScene,
  gistShapesShowcaseScene,
  gistShowcaseScene,
  moodRingShowcaseScene,
  starFormsShowcaseScene,
  type AmbientShowcaseScene,
  type ForgettingShowcaseScene,
  type GistShowcaseScene,
  type MoodRingShowcaseScene,
} from './showcase-scene.ts'

// Read-model stores (data, §3.2) — populated per GetUniverse read, read by the render bindings
export { useEpisodicMemoryStore, type EpisodicMemoryState } from './episodic-memory-store.ts'
export { useNeuronStore, type NeuronState } from './neuron-store.ts'
export { useSynapseStore, type SynapseState } from './synapse-store.ts'
export { resetUniverseUserState } from './user-state-reset.ts'
