import { useCallback, useEffect, useMemo } from 'react'
import type { ActorRefFrom } from 'xstate'
import { useSelector } from '@cosimosi/state-machine/react'
import { universeNavigationMachine } from '../universe-navigation.machine.ts'
import { useDiaryMemoryNavigationStore } from '../diary-memory-navigation-store.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useSpotlightStore } from '../spotlight-store.ts'
import { usePendingFlyTargetStore } from '../pending-fly-target-store.ts'

export function useDiaryMemoryNavigation(actor: ActorRefFrom<typeof universeNavigationMachine>) {
  const requestedIds = useDiaryMemoryNavigationStore((state) => state.memoryIds)
  const memories = useEpisodicMemoryStore((state) => state.byId)
  const pendingId = usePendingFlyTargetStore((state) => state.nodeId)
  const selected = useSelector(actor, (snapshot) => snapshot.context.selectedNodeId)
  const ids = useMemo(() => requestedIds.filter((id) => memories[id]), [requestedIds, memories])
  const index = selected ? ids.indexOf(selected) : -1
  const clear = useCallback(() => {
    useDiaryMemoryNavigationStore.getState().clear()
    useSpotlightStore.getState().clear()
  }, [])
  useEffect(() => {
    const arriving = pendingId !== null && requestedIds.includes(pendingId)
    if (selected && requestedIds.length > 0 && !requestedIds.includes(selected) && !arriving)
      clear()
  }, [selected, requestedIds, pendingId, clear])
  useEffect(() => {
    if (
      pendingId &&
      requestedIds.includes(pendingId) &&
      ids.length > 0 &&
      !ids.includes(pendingId)
    ) {
      usePendingFlyTargetStore.getState().request(ids[0], true)
      useSpotlightStore.getState().spotlight([ids[0]])
    }
  }, [pendingId, requestedIds, ids])
  const step = useCallback(
    (direction: -1 | 1) => {
      const live = useDiaryMemoryNavigationStore
        .getState()
        .memoryIds.filter((id) => useEpisodicMemoryStore.getState().byId[id])
      const current = actor.getSnapshot().context.selectedNodeId
      const position = current ? live.indexOf(current) : -1
      if (position < 0) return
      const target = live[position + direction]
      if (!target) return
      actor.send({ type: 'SELECT', nodeId: target })
      actor.send({ type: 'FLY', nodeId: target })
      useSpotlightStore.getState().spotlight([target])
    },
    [actor],
  )
  return {
    active: index >= 0 && ids.length > 1,
    position: index + 1,
    total: ids.length,
    hasPrevious: index > 0,
    hasNext: index >= 0 && index < ids.length - 1,
    previous: useCallback(() => step(-1), [step]),
    next: useCallback(() => step(1), [step]),
    clear,
  }
}
