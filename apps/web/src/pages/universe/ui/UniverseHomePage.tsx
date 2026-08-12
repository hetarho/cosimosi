import { useCallback, useEffect } from 'react'

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
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { Button, DecorateIcon, DiaryIcon, IconButton, SettingsIcon, Tooltip } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'
import { useDecorationRequestStore } from '@cosimosi/store'
import {
  universeNavigationMachine,
  useDeletionTargetStore,
  useEpisodicMemoryStore,
  useOpenDiaryTargetStore,
  useRecallTargetStore,
} from '@cosimosi/universe'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseViewToggle } from '../../../features/pin-universe-view/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
import { DecorationPanelSheet } from '../../../widgets/decoration-panel/index.ts'
import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'
import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { RecallFlowSheet } from '../../../widgets/recall-flow/index.ts'
import { StardustOverlay } from '../../../widgets/stardust/index.ts'
import { DetailPanel } from '../../../widgets/star-detail/index.ts'
import { UniverseCanvasWidget } from '../../../widgets/universe-canvas/index.ts'
import { UniverseTimeOverlay } from '../../../widgets/universe-time/index.ts'
import { WritingFlowSheet } from '../../../widgets/writing-flow/index.ts'

// Contains a renderer/read failure to the canvas area (mirror of the mobile screen's
// boundary) — without it a throw here would unmount the whole app to the root fallback.
function UniverseCanvasFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Button color="neutral" onClick={resetErrorBoundary}>
        {m.common_retry()}
      </Button>
    </div>
  )
}

// The home screen (`/`): the real memory universe full-bleed, with the write action floating
// over it (mirror of the mobile screen's HUD, §3.5). The widget owns the whole 3D block (renderer
// mount, graph read, sim, camera rig); the page only lays out the HUD. `onOpenReader` is the
// app-layer navigation seam to the diary archive (the page never reaches the router itself).
export function UniverseHomePage({
  onOpenReader,
  onOpenMe,
  onOpenAchievements,
}: {
  onOpenReader?: () => void
  onOpenMe?: () => void
  // The earn guide's one affordance. It is a separate intent rather than a tab argument so that no
  // page or widget has to name a route or import another page's tab type (§3.1).
  onOpenAchievements?: () => void
}) {
  // The navigation/selection actor is owned HERE (the app layer) so the canvas and the
  // star-detail panel share one selection — the canvas machine stays the single owner (§3.2).
  const navigationActorRef = useActorRef(universeNavigationMachine)

  // The onboarding run actor is owned here for the same reason the navigation actor is: a run is
  // control state belonging to the screen it narrates. The tour performs nothing — every state change
  // during it is the user's own press through the shipped slices below — so this page only starts the
  // run, forwards reported signals, and mounts the chrome OVER the live scene ([O2]).
  const tour = useSequenceRun(ONBOARDING_SCRIPT, { captionDwellMs: VALUES.sequence.captionDwellMs })
  const startTour = tour.start
  const advanceTour = tour.signal
  const tourRunning = tour.active
  const awaitedSignal = tour.step?.advance.on === 'signal' ? tour.step.advance.signal : null

  // "가입 직후, 우주로 들어가기 전" read as: the first caption is the first thing rendered over the
  // universe on the commit after the profile gate opens. A blocking interstitial route would have to
  // unmount the canvas that step 1 is about.
  useEffect(() => {
    const trigger = takeOnboardingStart(takeSignupCompletion())
    if (trigger) startTour(`onboarding-${trigger}-${Date.now()}`)
  }, [startTour])

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
      onOpenReader?.()
    },
    [requestOpenDiary, onOpenReader],
  )
  // Both deletion branches open over the canvas and both close the star panel first: two surfaces
  // that each declare themselves modal would otherwise stack, with two scrims and two focus traps,
  // and the selection left behind points at a star the flow may be about to remove.
  //
  // 놓아주기 is keyed by the episodic memory ([X6]); deleting a star's source diary is keyed by the
  // diary ([X1]), which the memory itself now names — the archive is a separate paged read this
  // route does not mount, so resolving the edge here would depend on the reader having been visited.
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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-text">
      <div className="absolute inset-0">
        {/* QueryErrorResetBoundary makes Retry actually recover a failed GetUniverse read:
            resetErrorBoundary → reset() flips react-query's error-reset flag so the remounted
            query refetches. Without it, throwOnError re-throws the cached error and the button
            is inert (react-query forces retryOnMount=false while the boundary is unreset). */}
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ObservedErrorBoundary fallback={UniverseCanvasFallback} onReset={reset}>
              <UniverseCanvasWidget navigationActorRef={navigationActorRef} />
            </ObservedErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        {/* The clock is centred on the SCREEN and taken OUT of flow, because the universe's time is
            the one reading that belongs to the place rather than to a corner of it ([T6]) — and
            because it must not push the reading beside it down. Everything else in the header is
            right-aligned flow, so the balance sits flush with the top on every width, from a phone to
            a desktop, with no breakpoint deciding which of the two gets the top line. */}
        <header className="relative flex flex-col items-end gap-3">
          {/* How the universe is being held, in the corner the eye starts from and out of the
              right-aligned flow — it belongs to the SPACE, like the clock beside it, rather than to
              the column of ways out of the canvas. */}
          <div className="absolute left-0 top-0">
            <UniverseViewToggle />
          </div>
          {/* HUD top ([T6]) with the acceleration host riding along; the acceleration renders nothing
              (the scene says time passing), and the consent modal is fixed, so neither cares that its
              host is a centred, zero-height box. */}
          {/* `w-max`: an absolute box offset by `left-1/2` is only offered the remaining half of the
              header to lay out in, which wrapped the pill's own line on a phone. */}
          <div className="absolute left-1/2 top-0 w-max -translate-x-1/2">
            <UniverseTimeOverlay />
          </div>
          {/* The persistent Twinkle balance + charge host ([G2][G3]), and beneath it the ways out of
              the canvas. */}
          <div className="flex flex-col items-end gap-3">
            <StardustOverlay onOpenAchievements={onOpenAchievements} />
            {/* A dense toolbar of icon-only controls: the account home, 꾸미기 ([P5], a panel over
                the canvas rather than a route) and the archive ([D2]) — a quiet column against the
                screen edge instead of a row of labelled buttons competing with the universe. Each
                carries its name in `label` and a tooltip, which §8 makes mandatory the moment an
                icon stands without one. pointer-events-auto so they stay tappable over the
                non-interactive HUD. */}
            {/* `drop-shadow-md` is the ground a fill-less control needs over a live sky: the glyph and
                its rim take their legibility from a dark halo hugging the strokes, the way the
                balance above does, rather than from a plate the scene cannot be seen through. */}
            <div className="pointer-events-auto flex flex-col gap-2 drop-shadow-md">
              <Tooltip content={m.universe_home_settings()} side="left">
                <IconButton
                  variant="outlined"
                  color="neutral"
                  label={m.universe_home_settings()}
                  icon={<SettingsIcon />}
                  onClick={() => onOpenMe?.()}
                />
              </Tooltip>
              <Tooltip content={m.store_open_action()} side="left">
                <IconButton
                  variant="outlined"
                  color="neutral"
                  label={m.store_open_action()}
                  icon={<DecorateIcon />}
                  onClick={requestDecoration}
                />
              </Tooltip>
              <Tooltip content={m.diary_reader_title()} side="left">
                <IconButton
                  variant="outlined"
                  color="neutral"
                  label={m.diary_reader_title()}
                  icon={<DiaryIcon />}
                  onClick={() => onOpenReader?.()}
                />
              </Tooltip>
            </div>
          </div>
        </header>
        <div className="pointer-events-auto mx-auto flex flex-col items-center gap-3 pb-2">
          {firstRun ? (
            <p className="max-w-sm text-center text-sm text-text-muted">
              {m.universe_first_run_welcome()}
            </p>
          ) : null}
          {/* An onboarding anchor is registered by wrapping an existing child at a composition site and
              passing nothing down — no prop, no flag, no callback — which is how the shipped slices
              beneath stay unaware that a tour exists ([I13]). */}
          <SequenceAnchor id={'universe-write-entry' satisfies OnboardingAnchor}>
            <WritingFlowSheet />
          </SequenceAnchor>
        </div>
      </div>
      {/* Read-only detail panel over the running canvas — opens on selection, remounts nothing (A1). */}
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
      <DeletionFlowSheet />
      {/* 우주 꾸미기 — a scrim-less sheet beside the universe it changes, opened from the HUD. */}
      <DecorationPanelSheet />
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
    </main>
  )
}
