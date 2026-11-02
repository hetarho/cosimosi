import { useCallback, useEffect } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'
import { createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { takeSignupCompletion } from '@cosimosi/account'
import { VALUES } from '@cosimosi/config'
import {
  ONBOARDING_SCRIPT,
  takeOnboardingStart,
  useOnboardingSignalStore,
  type OnboardingSignalReport,
} from '@cosimosi/onboarding'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { useActorRef } from '@cosimosi/state-machine/react'
import { useDeletionTargetStore } from '../deletion-target-store.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useOpenDiaryTargetStore } from '../open-diary-target-store.ts'
import { useRecallTargetStore } from '../recall-target-store.ts'
import { universeNavigationMachine } from '../universe-navigation.machine.ts'

export interface UniverseScreenInput {
  // Whether the universe is the focused screen. A backgrounded screen starts no tour and abandons a
  // running one; web keeps it mounted only while it is the route, so it passes true.
  active: boolean
  // The navigation seam to the diary archive; the screen never reaches the router itself.
  onOpenDiary(): void
}

export type OnboardingReportAction = 'none' | 'clear' | 'hold' | 'advance'

// What a reported onboarding signal does. With no run active a report is inert and cleared, so it can
// never survive into a later run. A report the current step is not waiting for is HELD rather than
// dropped: several steps are reading time, and a user who presses the highlighted control before a
// dwell finishes is ahead of the caption, not wrong — dropping it would leave the next step waiting
// forever for something that already happened.
export function onboardingReportAction(
  report: OnboardingSignalReport | null,
  running: boolean,
  awaited: string | null,
): OnboardingReportAction {
  if (!report) return 'none'
  if (!running) return 'clear'
  return report.signal === awaited ? 'advance' : 'hold'
}

// useUniverseScreen is the universe screen's controller, shared by both apps: the navigation actor the
// canvas and the star panel share, the onboarding run narrated over the live scene ([O2]), the
// first-run welcome, and the star panel's hand-offs to recall, the archive and the deletion flows.
export function useUniverseScreen({ active, onOpenDiary }: UniverseScreenInput) {
  // The canvas and the star-detail panel share one selection, so the actor is owned by the screen.
  const navigationActorRef = useActorRef(universeNavigationMachine)

  // A run is control state belonging to the screen it narrates. The tour performs nothing — every
  // state change during it is the user's own press — so the screen only starts the run and forwards
  // reported signals.
  const tour = useSequenceRun(ONBOARDING_SCRIPT, { captionDwellMs: VALUES.sequence.captionDwellMs })
  const { start: startTour, signal: advanceTour, abandon: abandonTour, active: tourRunning } = tour
  const awaitedSignal = tour.step?.advance.on === 'signal' ? tour.step.advance.signal : null

  // The first caption is the first thing rendered over the universe on the commit after the profile
  // gate opens; a blocking interstitial route would unmount the canvas that step 1 is about.
  useEffect(() => {
    if (!active) return
    const trigger = takeOnboardingStart(takeSignupCompletion())
    if (trigger) startTour(`onboarding-${trigger}-${Date.now()}`)
  }, [active, startTour])
  useEffect(() => {
    if (!active && tourRunning) abandonTour()
  }, [abandonTour, active, tourRunning])

  // The writing flow reports what it did into a one-slot channel; this is the only place a report
  // becomes an `ADVANCE`.
  const reportedSignal = useOnboardingSignalStore((state) => state.pending)
  const clearReportedSignal = useOnboardingSignalStore((state) => state.clear)
  useEffect(() => {
    const action = onboardingReportAction(reportedSignal, tourRunning, awaitedSignal)
    if (action === 'clear') clearReportedSignal()
    if (action === 'advance' && reportedSignal) {
      advanceTour(reportedSignal.signal)
      clearReportedSignal()
    }
  }, [advanceTour, awaitedSignal, clearReportedSignal, reportedSignal, tourRunning])

  // First-run welcome ([U2][V7]): a settled universe read with zero episodic memories is a beginning,
  // not an error. Derived from the shared GetUniverse read (deduped with the canvas's).
  const transport = useTransport()
  const universeQuery = useQuery(createGetUniverseQueryOptions(transport))
  const firstRun = universeQuery.isSuccess && (universeQuery.data?.memories.length ?? 0) === 0

  // 회고하기 opens the recall flow through the shared recall-target store; 원본 일기 보기 parks the
  // memory id in the open-diary-target store and navigates to the archive, which opens its diary.
  const requestRecallTarget = useRecallTargetStore((state) => state.request)
  const requestOpenDiary = useOpenDiaryTargetStore((state) => state.request)
  const openLetGo = useDeletionTargetStore((state) => state.openLetGo)
  const openFullDelete = useDeletionTargetStore((state) => state.openFullDelete)
  const handleRecallRequested = useCallback(
    (episodicMemoryId: string) => requestRecallTarget(episodicMemoryId),
    [requestRecallTarget],
  )
  const handleOpenDiary = useCallback(
    (episodicMemoryId: string) => {
      requestOpenDiary(episodicMemoryId)
      onOpenDiary()
    },
    [requestOpenDiary, onOpenDiary],
  )
  // Both deletion branches open over the canvas and both close the star panel first: two modal
  // surfaces would otherwise stack, and the selection left behind points at a star the flow may be
  // about to remove. 놓아주기 is keyed by the episodic memory ([X6]); deleting a star's source diary
  // is keyed by the diary ([X1]), which the memory itself names.
  const handleLetGo = useCallback(
    (episodicMemoryId: string) => {
      navigationActorRef.send({ type: 'CLEAR_SELECTION' })
      openLetGo(episodicMemoryId)
    },
    [navigationActorRef, openLetGo],
  )
  const handleDeleteSourceDiary = useCallback(
    (episodicMemoryId: string) => {
      const diaryId = useEpisodicMemoryStore.getState().byId[episodicMemoryId]?.diaryId
      if (!diaryId) return
      navigationActorRef.send({ type: 'CLEAR_SELECTION' })
      openFullDelete(diaryId)
    },
    [navigationActorRef, openFullDelete],
  )

  return {
    navigationActorRef,
    tour,
    firstRun,
    handleRecallRequested,
    handleOpenDiary,
    handleLetGo,
    handleDeleteSourceDiary,
  }
}
