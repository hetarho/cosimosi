import { useCallback } from 'react'
import type { Diary } from '@cosimosi/memory'
import { useDiaryMemoryNavigationStore } from '../diary-memory-navigation-store.ts'
import { usePendingFlyTargetStore } from '../pending-fly-target-store.ts'
import { useSpotlightStore } from '../spotlight-store.ts'

// Looking at a diary's stars uses already-read membership and has no economy or mutation seam.
export function useDiaryJump({ onExit }: { onExit: () => void }) {
  const initiateJump = useCallback(
    (diary: Diary) => {
      const memoryIds = diary.memories.map((member) => member.episodicMemoryId)
      const first = memoryIds[0]
      if (!first) return
      useDiaryMemoryNavigationStore.getState().start(memoryIds)
      usePendingFlyTargetStore.getState().request(first, true)
      useSpotlightStore.getState().spotlight([first])
      onExit()
    },
    [onExit],
  )
  return { exit: onExit, initiateJump }
}
