import { useCallback, useRef } from 'react'

import { QueryErrorResetBoundary } from '@tanstack/react-query'

import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import { universeNavigationMachine } from '@cosimosi/universe'

import { NebulaNotice } from '../../../entities/nebula/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
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
// mount, graph read, sim, camera rig); the page only lays out the HUD.
export function UniverseHomePage() {
  // The navigation/selection actor is owned HERE (the app layer) so the canvas and the
  // star-detail panel share one selection — the canvas machine stays the single owner (§3.2).
  const navigationActorRef = useActorRef(universeNavigationMachine)

  // The panel hands off recall + origin-diary as intents; the flows that consume them
  // (recall-flow-ui / diary-reader-page) are their own units, so the page records the request
  // for that consumer to read and does not recall/navigate here itself (A5/A6).
  const recallTargetRef = useRef<string | null>(null)
  const openDiaryTargetRef = useRef<string | null>(null)
  const handleRecallRequested = useCallback((episodicMemoryId: string) => {
    recallTargetRef.current = episodicMemoryId
  }, [])
  const handleOpenDiary = useCallback((episodicMemoryId: string) => {
    openDiaryTargetRef.current = episodicMemoryId
  }, [])
  // Gist bodies route to the paid gist-view surface; none render until the semanticization layer
  // adds them, so this seam records the target for that surface to consume (A7).
  const gistTargetRef = useRef<string | null>(null)
  const handleGistSelected = useCallback((episodicMemoryId: string) => {
    gistTargetRef.current = episodicMemoryId
  }, [])

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-text">
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
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <header className="flex items-start justify-between gap-3">
          <NebulaNotice />
          {/* HUD top ([T6]) with the acceleration veil + consent host riding along; the veil is a
              fixed layer, so the write action below (later in paint order) stays crisp over it. */}
          <UniverseTimeOverlay />
        </header>
        <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-3 pb-2">
          <WritingFlowSheet />
        </div>
      </div>
      {/* Read-only detail panel over the running canvas — opens on selection, remounts nothing (A1). */}
      <DetailPanel
        navigationActorRef={navigationActorRef}
        onRecallRequested={handleRecallRequested}
        onOpenDiary={handleOpenDiary}
        onGistSelected={handleGistSelected}
      />
    </main>
  )
}
