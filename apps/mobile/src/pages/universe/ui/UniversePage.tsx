import { StyleSheet, Text, View } from 'react-native'

import { QueryErrorResetBoundary } from '@tanstack/react-query'

import { type OnboardingAnchor } from '@cosimosi/onboarding'
import { Button, DecorateIcon, DiaryIcon, IconButton, SettingsIcon, tokens } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'
import { useUniverseScreen } from '@cosimosi/universe/react'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'

import { useDecorationRequestStore } from '@cosimosi/store'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseViewToggle } from '../../../features/pin-universe-view/index.ts'
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
  const insets = useScreenInsets()
  // The navigation actor, the onboarding run, the first-run read and the star panel's hand-offs are the
  // package's universe-screen controller; this page lays out the HUD over the canvas.
  const {
    navigationActorRef,
    tour,
    tourCaption,
    firstRun,
    handleRecallRequested,
    handleOpenDiary,
    handleLetGo,
    handleDeleteSourceDiary,
  } = useUniverseScreen({ active, onOpenDiary })
  const requestDecoration = useDecorationRequestStore((state) => state.request)

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
      {/* The top chrome is ONE column below the device inset, not absolutely-placed rows: fixed
          offsets guessed each row's height, so the balance and the account/archive buttons overlapped
          as soon as either grew — and all of it sat under the status bar. The left pair is the
          exception: it sits out of this column's flow so it never pushes the balance reading down. */}
      <View style={[styles.topChrome, { top: insets.top + tokens.spacing[3] }]}>
        {/* How the universe is being held, in the corner the eye starts from, and under it the
            universe's time: both belong to the SPACE rather than to the row of ways out of the canvas.
            The clock keeps left because the sequence chrome's always-visible skip owns the top edge's
            right half on a phone, and a centred reading would run under it. */}
        <View style={styles.topLeft} pointerEvents="box-none">
          <UniverseViewToggle />
          <UniverseTimeOverlay />
        </View>
        {/* The persistent Twinkle balance + charge host ([G2][G3]), then a dense toolbar of
            icon-only controls: the account home, 꾸미기 ([P5], a panel over the canvas rather than a
            route) and the archive ([D2]) — a quiet column against the screen edge instead of a row
            of labelled buttons competing with the universe. There is no hover on touch, so each
            one's `label` is the whole of its name (UI-57). */}
        {/* `box-none`: the column spans the chrome's width under its skip-band padding, so its empty
            area must pass touches through to the view toggle beneath it (ONB-13). */}
        <View style={styles.topRight} pointerEvents="box-none">
          <StardustOverlay onOpenAchievements={onOpenAchievements} />
          <IconButton
            variant="outlined"
            color="neutral"
            label={m.universe_home_settings()}
            icon={<SettingsIcon />}
            onPress={onOpenMe}
          />
          <IconButton
            variant="outlined"
            color="neutral"
            label={m.store_open_action()}
            icon={<DecorateIcon />}
            onPress={requestDecoration}
          />
          <IconButton
            variant="outlined"
            color="neutral"
            label={m.diary_reader_title()}
            icon={<DiaryIcon />}
            onPress={onOpenDiary}
          />
        </View>
      </View>
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
        caption={tourCaption}
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
  topLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
  },
  // Held clear of the top band the sequence chrome's always-visible skip owns (its small button set
  // `spacing[4]` into the screen), the same band the web HUD holds clear.
  topRight: {
    alignItems: 'flex-end',
    gap: tokens.spacing[3],
    paddingTop: tokens.spacing[8] + tokens.spacing[3],
  },
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
