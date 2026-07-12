import { useCallback, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { QueryErrorResetBoundary } from '@tanstack/react-query'

import { Button, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { universeNavigationMachine } from '@cosimosi/universe'

import { NebulaNotice } from '../../../entities/nebula/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
import { DetailPanel } from '../../../widgets/star-detail/index.ts'
import { UniverseCanvasWidget } from '../../../widgets/universe-canvas/index.ts'
import { UniverseTimeOverlay } from '../../../widgets/universe-time/index.ts'
import { WritingFlowSheet } from '../../../widgets/writing-flow/index.ts'

// The universe screen: the real memory universe full-bleed with a floating action over
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

export function UniverseScreen() {
  // The navigation/selection actor is owned HERE (the app layer) so the canvas and the star-detail
  // panel share one selection — the canvas machine stays the single owner (§3.2), as on web.
  const navigationActorRef = useActorRef(universeNavigationMachine)

  // The panel hands off recall + origin-diary as intents; their consuming flows are their own
  // units, so the screen records the request for that consumer and does not act here (A5/A6).
  const recallTargetRef = useRef<string | null>(null)
  const openDiaryTargetRef = useRef<string | null>(null)
  const gistTargetRef = useRef<string | null>(null)
  const handleRecallRequested = useCallback((episodicMemoryId: string) => {
    recallTargetRef.current = episodicMemoryId
  }, [])
  const handleOpenDiary = useCallback((episodicMemoryId: string) => {
    openDiaryTargetRef.current = episodicMemoryId
  }, [])
  const handleGistSelected = useCallback((episodicMemoryId: string) => {
    gistTargetRef.current = episodicMemoryId
  }, [])

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
      <View style={styles.notice}>
        <NebulaNotice />
      </View>
      {/* Mounted at the screen root so its absolute veil/HUD span the full screen; before the
          write action so the veil dims the scene + notice but never the primary affordance. */}
      <UniverseTimeOverlay />
      <View style={styles.hud}>
        <WritingFlowSheet />
      </View>
      {/* Read-only detail bottom sheet over the running canvas — opens on selection (A1). */}
      <DetailPanel
        navigationActorRef={navigationActorRef}
        onRecallRequested={handleRecallRequested}
        onOpenDiary={handleOpenDiary}
        onGistSelected={handleGistSelected}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notice: { position: 'absolute', left: 16, right: 16, top: 24 },
  hud: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  fallback: { flex: 1, gap: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { color: tokens.color['text-muted'], fontSize: 15, textAlign: 'center' },
})
