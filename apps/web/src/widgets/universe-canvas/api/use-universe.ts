import { useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { universeFromResponse, type UniverseSnapshot } from '@cosimosi/memory'

import {
  useDeletionTargetStore,
  useEpisodicMemoryStore,
  useNeuronStore,
  useReleasedGroupsStore,
  useSynapseStore,
} from '@cosimosi/universe'

import { syncUniverseClock } from '../../../entities/universe-clock/index.ts'

export interface UniverseReadState {
  universe: UniverseSnapshot | null
}

// The widget's GetUniverse read: the generated Connect query (GET; key + cache policy
// owned by api-client/client-cache) mapped DTO→domain at the entity mapper seam, then
// written into the four entity stores every response (Query cache → store).
// `universe.universeTime` is the read-time-derivation input for @cosimosi/memory-logic —
// this unit never re-derives that math. Stores are data (§3.2); nothing here is per-frame.
// A fetch failure (401/500/network) throws to the widget's error boundary via throwOnError
// so it surfaces a retry instead of an indistinguishable empty universe; the stores are
// cleared when there is no universe so a prior user's data can't linger after sign-out.
export function useUniverse(): UniverseReadState {
  const transport = useTransport()
  const queryOptions = useMemo(() => createGetUniverseQueryOptions(transport), [transport])
  const query = useQuery({ ...queryOptions, throwOnError: true })
  const universe = useMemo(
    () => (query.data ? universeFromResponse(query.data) : null),
    [query.data],
  )
  const setMemories = useEpisodicMemoryStore((state) => state.setAll)
  const setNeurons = useNeuronStore((state) => state.setAll)
  const setSynapses = useSynapseStore((state) => state.setAll)

  useEffect(() => {
    if (!universe) {
      setMemories([])
      setNeurons([])
      setSynapses([])
      syncUniverseClock(null)
      // A signed-out (or empty) read must not leave a prior user's release groups or open deletion
      // target behind — RestoreSection reads them cross-route, so clear them with the mirrors.
      useReleasedGroupsStore.getState().reset()
      useDeletionTargetStore.getState().clear()
      return
    }
    // Merge server truth with any optimistically-launched memory not yet visible
    // server-side (an eager refetch — or a stale GET cache — right after a launch must
    // not drop the just-launched memory). Server rows win on id; optimistic-only rows
    // survive until the read includes them. Only when a universe is present, so a signed-out
    // empty read still clears a prior user's data.
    const serverIds = new Set(universe.memories.map((memory) => memory.id))
    const optimisticOnly = Object.values(useEpisodicMemoryStore.getState().byId).filter(
      (memory) => !serverIds.has(memory.id),
    )
    setMemories([...universe.memories, ...optimisticOnly])
    setNeurons(universe.neurons)
    setSynapses(universe.synapses)
    syncUniverseClock(universe.universeTime)
  }, [universe, setMemories, setNeurons, setSynapses])

  return { universe }
}
