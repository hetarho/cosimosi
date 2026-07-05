import { QueryErrorResetBoundary } from '@tanstack/react-query'

import { ObservedErrorBoundary, type ObservedErrorBoundaryFallbackProps } from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { NebulaNotice } from '../../../entities/nebula/index.ts'
import { UniverseCanvasWidget } from '../../../widgets/universe-canvas/index.ts'
import { WritingFlowSheet } from '../../../widgets/writing-flow/index.ts'

// Contains a renderer/read failure to the canvas area (mirror of the mobile screen's
// boundary) — without it a throw here would unmount the whole app to the root fallback.
function UniverseCanvasFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Button variant="secondary" onClick={resetErrorBoundary}>
        {m.common_retry()}
      </Button>
    </div>
  )
}

// The home screen (`/`): the real memory universe full-bleed, with a few floating actions
// over it. The widget owns the whole 3D block (renderer mount, graph read, sim, camera
// rig); the page only lays out the HUD. The actions are inert placeholders — no handlers
// are wired to them.
export function UniverseHomePage() {
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
              <UniverseCanvasWidget />
            </ObservedErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <header className="flex items-start justify-between gap-3">
          <NebulaNotice />
          <Button variant="secondary" className="pointer-events-auto">
            {m.universe_home_settings()}
          </Button>
        </header>
        <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-3 pb-2">
          <WritingFlowSheet />
          <Button variant="secondary">{m.universe_home_explore()}</Button>
        </div>
      </div>
    </main>
  )
}
