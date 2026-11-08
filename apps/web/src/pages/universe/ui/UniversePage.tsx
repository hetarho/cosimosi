import { QueryErrorResetBoundary } from '@tanstack/react-query'

import { type OnboardingAnchor } from '@cosimosi/onboarding'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import {
  Button,
  DecorateIcon,
  DiaryIcon,
  ICON_SIZE_LG,
  IconButton,
  SettingsIcon,
  Tooltip,
} from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'
import { useUniverseScreen } from '@cosimosi/universe/react'
import { useDecorationRequestStore } from '@cosimosi/store'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseViewToggle } from '../../../features/pin-universe-view/index.ts'
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
// mount, graph read, sim, camera rig); the page only lays out the HUD. `onOpenDiary` is the
// app-layer navigation seam to the diary archive (the page never reaches the router itself).
export interface UniversePageProps {
  onOpenDiary: () => void
  onOpenMe?: () => void
  // The earn guide's one affordance. It is a separate intent rather than a tab argument so that no
  // page or widget has to name a route or import another page's tab type (§3.1).
  onOpenAchievements?: () => void
}

export function UniversePage({ onOpenDiary, onOpenMe, onOpenAchievements }: UniversePageProps) {
  // The navigation actor, the onboarding run, the first-run read and the star panel's hand-offs are the
  // package's universe-screen controller; this page lays out the HUD over the canvas.
  const {
    navigationActorRef,
    tour,
    firstRun,
    handleRecallRequested,
    handleOpenDiary,
    handleLetGo,
    handleDeleteSourceDiary,
  } = useUniverseScreen({ active: true, onOpenDiary })
  const requestDecoration = useDecorationRequestStore((state) => state.request)

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
        {/* The clock is taken OUT of flow, because the universe's time is the one reading that
            belongs to the place rather than to a corner of it ([T6]) — and because it must not push
            the reading beside it down. Everything else in the header is right-aligned flow, held
            clear of the top band the sequence chrome's always-visible skip owns on every width. */}
        <header className="relative flex flex-col items-end gap-3">
          {/* How the universe is being held, in the corner the eye starts from and out of the
              right-aligned flow — it belongs to the SPACE, like the clock beside it, rather than to
              the column of ways out of the canvas. */}
          <div className="absolute left-0 top-0">
            <UniverseViewToggle />
          </div>
          {/* HUD top ([T6]) with the acceleration host riding along; the acceleration renders nothing
              (the scene says time passing), and the consent modal is fixed, so neither cares that its
              host is a zero-height box. From `sm` up it is centred on the SCREEN; on a phone it keeps
              left under the view toggle, because the skip owns the top edge's right half there and a
              centred reading would run under it. */}
          {/* `w-max`: an absolute box offset by `left-1/2` is only offered the remaining half of the
              header to lay out in, which wrapped the pill's own line on a phone. */}
          <div className="absolute left-0 top-11 w-max sm:left-1/2 sm:top-0 sm:-translate-x-1/2">
            <UniverseTimeOverlay />
          </div>
          {/* The persistent Twinkle balance + charge host ([G2][G3]), and beneath it the ways out of
              the canvas. Held clear of the top edge, which the sequence chrome's always-visible skip
              owns on every width — a column flush with the top would sit under it while the tour
              runs. */}
          <div className="flex flex-col items-end gap-3 pt-11">
            <StardustOverlay onOpenAchievements={onOpenAchievements} />
            {/* A dense toolbar of icon-only controls: the account home, 꾸미기 ([P5], a panel over
                the canvas rather than a route) and the archive ([D2]) — a quiet column against the
                screen edge instead of a row of labelled buttons competing with the universe.
                pointer-events-auto so they stay tappable over the non-interactive HUD. */}
            {/* No rim and no plate: over a live sky a bordered circle reads as a hole punched in the
                universe, and three of them read as a widget tray. What gives a fill-less glyph its
                ground is `drop-shadow-md` — a dark halo hugging the strokes, the way the balance above
                takes its legibility — so the controls are round, borderless, and lit only by that
                shadow. Each still carries its name in `label` and a tooltip, which §8 makes mandatory
                the moment an icon stands without one.
                The glyphs take the LARGER cut while the buttons keep their box: with no rim and no
                plate the drawing IS the whole control, and at body-text size it read as a mark
                printed on the sky rather than as something to press. The box is the touch target and
                is deliberately unchanged. */}
            <div className="pointer-events-auto flex flex-col gap-2 drop-shadow-md">
              <Tooltip content={m.universe_home_settings()} side="left">
                <IconButton
                  variant="text"
                  color="neutral"
                  className="rounded-full"
                  label={m.universe_home_settings()}
                  icon={<SettingsIcon size={ICON_SIZE_LG} />}
                  onClick={() => onOpenMe?.()}
                />
              </Tooltip>
              <Tooltip content={m.store_open_action()} side="left">
                <IconButton
                  variant="text"
                  color="neutral"
                  className="rounded-full"
                  label={m.store_open_action()}
                  icon={<DecorateIcon size={ICON_SIZE_LG} />}
                  onClick={requestDecoration}
                />
              </Tooltip>
              <Tooltip content={m.diary_reader_title()} side="left">
                <IconButton
                  variant="text"
                  color="neutral"
                  className="rounded-full"
                  label={m.diary_reader_title()}
                  icon={<DiaryIcon size={ICON_SIZE_LG} />}
                  onClick={onOpenDiary}
                />
              </Tooltip>
            </div>
          </div>
        </header>
        {/* The scene's footer, marked the way the demo marks its own, so the sequence guide keeps its
            caption above the first-run welcome and the write control instead of landing on them. */}
        <div
          data-scene-footer=""
          className="pointer-events-auto mx-auto flex flex-col items-center gap-3 pb-2"
        >
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
