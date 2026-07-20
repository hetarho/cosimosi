import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { QueryErrorResetBoundary, useQuery } from '@tanstack/react-query'

import { createGetUniverseQueryOptions } from '@cosimosi/api-client'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import {
  universeNavigationMachine,
  useDeletionTargetStore,
  useDiaryStore,
  useOpenDiaryTargetStore,
  useRecallTargetStore,
} from '@cosimosi/universe'

import { NebulaNotice } from '../../../entities/nebula/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
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
export function UniverseHomePage({ onOpenReader }: { onOpenReader?: () => void }) {
  // The navigation/selection actor is owned HERE (the app layer) so the canvas and the
  // star-detail panel share one selection — the canvas machine stays the single owner (§3.2).
  const navigationActorRef = useActorRef(universeNavigationMachine)

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
        onOpenReader?.()
      }
    },
    [openFullDelete, requestOpenDiary, onOpenReader],
  )

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
              fixed layer, so the write action below (later in paint order) stays crisp over it. The
              persistent Twinkle balance + charge host ([G2][G3]) sit beneath it, top-right. */}
          <div className="flex flex-col items-end gap-3">
            <UniverseTimeOverlay />
            <StardustOverlay />
            {/* The quiet way into the archive ([D2]) — a restrained affordance, not a persistent
                chrome bar. pointer-events-auto so it stays tappable over the non-interactive HUD. */}
            <div className="pointer-events-auto">
              <Button color="neutral" size="sm" onClick={() => onOpenReader?.()}>
                {m.diary_reader_title()}
              </Button>
            </div>
          </div>
        </header>
        <div className="pointer-events-auto mx-auto flex flex-col items-center gap-3 pb-2">
          {firstRun ? (
            <p className="max-w-sm text-center text-sm text-text-muted">
              {m.universe_first_run_welcome()}
            </p>
          ) : null}
          <WritingFlowSheet />
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
    </main>
  )
}
