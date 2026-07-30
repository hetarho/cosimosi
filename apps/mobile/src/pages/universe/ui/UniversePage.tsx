import { useCallback, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { QueryErrorResetBoundary, useQuery } from '@tanstack/react-query'

import { createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { takeSignupCompletion } from '@cosimosi/auth'
import { VALUES } from '@cosimosi/config'
import {
  ONBOARDING_SCRIPT,
  takeOnboardingStart,
  useOnboardingSignalStore,
  type OnboardingAnchor,
} from '@cosimosi/onboarding'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { Button, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import {
  universeNavigationMachine,
  useDeletionTargetStore,
  useDiaryStore,
  useOpenDiaryTargetStore,
  useRecallTargetStore,
} from '@cosimosi/universe'

import { useDecorationRequestStore } from '@cosimosi/store'

import { NebulaNotice } from '../../../entities/nebula/index.ts'
import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
import { useScreenInsets } from '../../../shared/native/index.ts'
import { DecorationPanelSheet } from '../../../widgets/decoration-panel/index.ts'
import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'
import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { RecallFlowSheet } from '../../../widgets/recall-flow/index.ts'
import { StardustOverlay } from '../../../widgets/stardust/index.ts'
import { DetailPanel } from '../../../widgets/star-detail/index.ts'
import { UniverseCanvasWidget } from '../../../widgets/universe-canvas/index.ts'
import { UniverseTimeOverlay } from '../../../widgets/universe-time/index.ts'
import { WritingFlowSheet } from '../../../widgets/writing-flow/index.ts'
// The universe page: the real memory universe full-bleed with a floating action over
// it. The shared widget owns the whole 3D block (renderer mount, GetUniverse read, sim,
// camera rig) — the same slice as web (§3.5). Error-boundaried so a WebGPU/native
// failure shows a fallback instead of crashing.
function RendererFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{m.universe_renderer_unavailable()}</Text>
      <Button color="neutral" onPress={resetErrorBoundary}>
        {m.common_retry()}
      </Button>
    </View>
  )
}

export interface UniversePageProps {
  active: boolean
  onOpenDiary: () => void
  onOpenMe: () => void
  // The earn guide's one affordance. A separate intent rather than a tab argument, so no page or
  // widget has to name a route or import another page's tab type (§3.1).
  onOpenAchievements: () => void
}

export function UniversePage({
  active,
  onOpenDiary,
  onOpenMe,
  onOpenAchievements,
}: UniversePageProps) {
  // The navigation/selection actor is owned HERE (the page layer) so the canvas and the star-detail
  // panel share one selection — the canvas machine stays the single owner (§3.2), as on web.
  const navigationActorRef = useActorRef(universeNavigationMachine)
  const insets = useScreenInsets()
  // Only the focused screen consumes the shared deletion target — the diary-reader screen stays
  // mounted underneath in the native stack, so an unfocused sheet must not also open the flow.

  // The onboarding run actor is owned here for the same reason the navigation actor is: a run is
  // control state belonging to the screen it narrates. The tour performs nothing — every state change
  // during it is the user's own press through the shipped slices below — so this page only starts the
  // run, forwards reported signals, and mounts the chrome OVER the live scene ([O2]).
  const tour = useSequenceRun(ONBOARDING_SCRIPT, { captionDwellMs: VALUES.sequence.captionDwellMs })
  const startTour = tour.start
  const advanceTour = tour.signal
  const abandonTour = tour.abandon
  const tourRunning = tour.active
  const awaitedSignal = tour.step?.advance.on === 'signal' ? tour.step.advance.signal : null

  // Keyed on focus rather than on mount, which is the one place this leg has to differ from web's: the
  // native stack pushes /me OVER this screen and pops back to the same mounted instance, so a replay
  // requested there would never be read if the take ran only once. Focus also covers the first arrival.
  useEffect(() => {
    if (!active) return
    const trigger = takeOnboardingStart(takeSignupCompletion())
    if (trigger) startTour(`onboarding-${trigger}-${Date.now()}`)
  }, [active, startTour])

  // Leaving the universe ends the run — which web gets for free by unmounting the page, and this screen
  // has to ask for because the native stack keeps it mounted underneath. Without it the dwell timers
  // would walk the tour to its end behind another screen, with the skip unreachable while they did.
  // A replay is one tap away in /me, so ending is the cheap outcome.
  useEffect(() => {
    if (!active && tourRunning) abandonTour()
  }, [abandonTour, active, tourRunning])

  // The writing flow reports what it did into a one-slot channel; this is the only place a report
  // becomes an `ADVANCE`.
  //
  // A report the current step is not waiting for is HELD rather than dropped, and that is the whole
  // reason this reads `awaitedSignal` instead of handing everything to the engine's own guard: several
  // steps are reading time, and a user who presses the highlighted control before a dwell finishes is
  // ahead of the caption, not wrong. Dropping the report there would leave the next step waiting forever
  // for something that already happened — unrecoverable once the launch is the thing that happened.
  // With no run active a report is inert and cleared, so it can never survive into a later run.
  const reportedSignal = useOnboardingSignalStore((state) => state.pending)
  const clearReportedSignal = useOnboardingSignalStore((state) => state.clear)
  useEffect(() => {
    if (!reportedSignal) return
    if (!tourRunning) {
      clearReportedSignal()
      return
    }
    if (reportedSignal.signal !== awaitedSignal) return
    advanceTour(reportedSignal.signal)
    clearReportedSignal()
  }, [advanceTour, awaitedSignal, clearReportedSignal, reportedSignal, tourRunning])

  // First-run welcome ([U2][V7]): a settled universe read with zero episodic memories is a
  // beginning, not an error — the same canvas renders the gray latent field beneath, and the HUD
  // adds one quiet welcome line above the existing 일기 쓰기 entry. Derived from the shared
  // GetUniverse read (deduped with the canvas widget's), never a separate route or flag.
  const transport = useTransport()
  const universeQuery = useQuery(createGetUniverseQueryOptions(transport))
  const firstRun = universeQuery.isSuccess && (universeQuery.data?.memories.length ?? 0) === 0

  // 회고하기 opens the recall flow via the shared recall-target store (the flow widget subscribes).
  // 원본 일기 보기 parks the memory id in the open-diary-target store and navigates to the archive,
  // where the reader opens the owning diary ([D2]).
  const requestRecallTarget = useRecallTargetStore((state) => state.request)
  const requestOpenDiary = useOpenDiaryTargetStore((state) => state.request)
  const requestDecoration = useDecorationRequestStore((state) => state.request)
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
  // 놓아주기 opens the letting-go branch over the canvas (keyed by the episodic memory). Deleting a
  // star's source diary is diary-scoped: the FE has no episodic→diary map on the universe read, so
  // resolve it from the diary mirror when it is loaded (open the flow over the canvas); otherwise
  // fall back to the reader (the memory parked for its owning diary), where the per-entry delete
  // lives — the same origin-diary resolution the open-diary intent uses.
  const handleLetGo = useCallback(
    (episodicMemoryId: string) => openLetGo(episodicMemoryId),
    [openLetGo],
  )
  const handleDeleteSourceDiary = useCallback(
    (episodicMemoryId: string) => {
      const owningDiary = Object.values(useDiaryStore.getState().byId).find((diary) =>
        diary.memories.some((member) => member.episodicMemoryId === episodicMemoryId),
      )
      if (owningDiary) {
        openFullDelete(owningDiary.id)
      } else {
        requestOpenDiary(episodicMemoryId)
        onOpenDiary()
      }
    },
    [openFullDelete, requestOpenDiary, onOpenDiary],
  )

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {/* QueryErrorResetBoundary makes Retry actually recover a failed GetUniverse read:
            resetErrorBoundary → reset() flips react-query's error-reset flag so the remounted
            query refetches. Without it, throwOnError re-throws the cached error and the button
            is inert (react-query forces retryOnMount=false while the boundary is unreset). */}
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ObservedErrorBoundary fallback={RendererFallback} onReset={reset}>
              <UniverseCanvasWidget navigationActorRef={navigationActorRef} />
            </ObservedErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </View>
      {/* The top chrome is ONE column below the device inset, not three absolutely-placed rows: fixed
          offsets guessed each row's height, so the balance panel and the account/archive buttons
          overlapped as soon as either grew — and all of it sat under the status bar. */}
      <View style={[styles.topChrome, { top: insets.top + tokens.spacing[3] }]}>
        <NebulaNotice />
        {/* The persistent Twinkle balance + charge host ([G2][G3]). */}
        <View style={styles.topRight}>
          <StardustOverlay onOpenAchievements={onOpenAchievements} />
        </View>
        {/* The quiet ways into the archive ([D2]) and the signed-in account home — restrained
            affordances, not persistent chrome. */}
        <View style={styles.topRight}>
          {/* 꾸미기 joins the same restrained row as the archive and the account home ([P5]): the
              panel opens over the canvas, so the affordance belongs to the HUD, not to a route. */}
          <Button color="neutral" size="sm" onPress={requestDecoration}>
            {m.store_open_action()}
          </Button>
          <Button color="neutral" size="sm" onPress={onOpenMe}>
            {m.me_title()}
          </Button>
          <Button color="neutral" size="sm" onPress={onOpenDiary}>
            {m.diary_reader_title()}
          </Button>
        </View>
      </View>
      {/* Mounted at the screen root so its absolute veil/HUD span the full screen; before the
          write action so the veil dims the scene + notice but never the primary affordance. */}
      <UniverseTimeOverlay />
      <View style={[styles.hud, { bottom: insets.bottom + tokens.spacing[6] }]}>
        {firstRun ? <Text style={styles.welcome}>{m.universe_first_run_welcome()}</Text> : null}
        {/* An onboarding anchor is registered by wrapping an existing child at a composition site and
            passing nothing down — no prop, no flag, no callback — which is how the shipped slices
            beneath stay unaware that a tour exists ([I13]). */}
        <SequenceAnchor id={'universe-write-entry' satisfies OnboardingAnchor}>
          <WritingFlowSheet />
        </SequenceAnchor>
      </View>
      {/* Read-only detail bottom sheet over the running canvas — opens on selection (A1). */}
      <DetailPanel
        navigationActorRef={navigationActorRef}
        onRecallRequested={handleRecallRequested}
        onOpenDiary={handleOpenDiary}
        onDeleteSourceDiary={handleDeleteSourceDiary}
        onLetGo={handleLetGo}
      />
      {/* The recall (회고하기) flow — opens over the canvas when the panel requests a recall. */}
      <RecallFlowSheet />
      {/* The deletion + letting-go flow — opens over the canvas from the panel's delete/놓아주기. */}
      <DeletionFlowSheet active={active} />
      {/* 우주 꾸미기 — a scrim-less sheet beside the universe it changes, opened from the HUD. */}
      <DecorationPanelSheet active={active} />
      {/* Last, so the caption band, the ring and the always-visible skip sit above the HUD. Nothing
          beneath is remounted, disabled or blocked: leaving the route ends the run as `abandoned`, and
          `completed`, `skipped` and `abandoned` all leave exactly nothing behind ([O4]). */}
      <SequenceGuide
        active={tour.active}
        caption={tour.step?.caption ?? null}
        anchorRect={tour.anchorRect}
        progress={tour.progress}
        onSkip={tour.skip}
        onRemeasure={tour.remeasure}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topChrome: {
    position: 'absolute',
    left: tokens.spacing[4],
    right: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  topRight: { alignItems: 'flex-end', gap: tokens.spacing[2] },
  hud: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: tokens.spacing[3] },
  welcome: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    textAlign: 'center',
    maxWidth: 320,
    paddingHorizontal: 24,
  },
  fallback: { flex: 1, gap: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    textAlign: 'center',
  },
})
