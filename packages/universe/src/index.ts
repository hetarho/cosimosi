// @cosimosi/universe — the pure, cross-app core of the universe write + render vertical: the
// read-model stores, the selection machine, the flows' shared state and the time presentation core.
// The scene projection (graph build, sim bridge, camera rig, navigation, channels, latent field,
// awaken pick, spotlight) is `./scene` and the showcase scenes are `./showcase`, so a scene change
// has one home. Free of three/DOM/native by rule; web and mobile import it verbatim and keep only
// their platform forks (worker spawner, canvas host, DOM/RN sheets). The R3F bindings that consume
// these live in @cosimosi/universe-render.
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

// The awaken's idempotency registry and the latent field's consumed marks: account state the scene
// reads, cleared with the rest on a scope change.
export { useAwakenRegistryStore, type AwakenRegistryState } from './awaken-registry.ts'
export { useLatentConsumedStore, type LatentConsumedState } from './latent-consumed-store.ts'

// What a memory reads as now: its forgetting stage, its decayed text and its readings.
export {
  currentDecayStage,
  currentDecaySpans,
  currentDecayText,
  memoryReadings,
  type MemoryReadings,
  type DecayTextSpan,
} from './current-decay-text.ts'

// Read-model stores (data, §3.2) — populated per GetUniverse read, read by the render bindings
export { useEpisodicMemoryStore, type EpisodicMemoryState } from './episodic-memory-store.ts'
export { useNeuronStore, type NeuronState } from './neuron-store.ts'
export { useSynapseStore, type SynapseState } from './synapse-store.ts'
export { resetUniverseUserState } from './user-state-reset.ts'

export type { RecallPassagePart } from './recall-draft-store.ts'
