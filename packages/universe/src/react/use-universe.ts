import { useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetUniverseQueryOptions } from '@cosimosi/api-client'
import { createUniverseMapper, type UniverseSnapshot } from '@cosimosi/memory'

import { useDeletionTargetStore } from '../deletion-target-store.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useNeuronStore } from '../neuron-store.ts'
import { useReleasedGroupsStore } from '../released-groups-store.ts'
import { syncUniverseClock } from '../sync-universe-clock.ts'
import { useSynapseStore } from '../synapse-store.ts'

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
  const mapUniverse = useMemo(() => createUniverseMapper(), [])
  const serverUniverse = useMemo(
    () => (query.data ? mapUniverse(query.data) : null),
    [query.data, mapUniverse],
  )
  const setMemories = useEpisodicMemoryStore((state) => state.reconcile)
  const memoriesById = useEpisodicMemoryStore((state) => state.byId)
  const memoryIds = useEpisodicMemoryStore((state) => state.ids)
  const universe = useMemo(
    () =>
      serverUniverse
        ? { ...serverUniverse, memories: memoryIds.map((id) => memoriesById[id]!) }
        : null,
    [serverUniverse, memoriesById, memoryIds],
  )
  const setNeurons = useNeuronStore((state) => state.setAll)
  const setSynapses = useSynapseStore((state) => state.setAll)

  useEffect(() => {
    const universe = serverUniverse
    if (!universe) {
      useEpisodicMemoryStore.getState().clear()
      setNeurons([])
      setSynapses([])
      syncUniverseClock(null)
      // A signed-out (or empty) read must not leave a prior user's release groups or open deletion
      // target behind — RestoreSection reads them cross-route, so clear them with the mirrors.
      useReleasedGroupsStore.getState().reset()
      useDeletionTargetStore.getState().clear()
      return
    }
    // Only explicitly pending launches survive an authoritative snapshot omission.
    setMemories(universe.memories)
    setNeurons(universe.neurons)
    setSynapses(universe.synapses)
    syncUniverseClock(universe.universeTime)
  }, [serverUniverse, setMemories, setNeurons, setSynapses])

  return { universe }
}
