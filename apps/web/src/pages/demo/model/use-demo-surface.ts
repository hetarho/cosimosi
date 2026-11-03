import { shallowEqual, useActorRef, useSelector } from '@cosimosi/state-machine/react'

import { demoSurface, demoSurfaceMachine } from './demo-surface.machine.ts'

/**
 * The page's one open surface, read as the facts each surface renders from. Every value here is a
 * projection of the same machine state, so no two of them can claim the screen at once.
 */
export function useDemoSurface() {
  const actor = useActorRef(demoSurfaceMachine)
  // A fresh object per read, so it must compare shallowly or every check reads as a change.
  const surface = useSelector(actor, demoSurface, shallowEqual)
  const tasted = useSelector(actor, (snapshot) => snapshot.context.tasted)
  return {
    actor,
    surface,
    tasted,
    sheetOpen: surface.kind === 'writing',
    selectedMemoryId: surface.kind === 'memory' ? surface.memoryId : null,
    recallMemoryId: surface.kind === 'recall' ? surface.memoryId : null,
    recallApplied: surface.kind === 'recall' && surface.applied,
    readingDiaryId: surface.kind === 'reading' ? surface.diaryId : null,
    decorateOpen: surface.kind === 'decorating',
  }
}
