// @vitest-environment jsdom
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { createMemoryMockTransport } from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  universeNavigationMachine,
  useEpisodicMemoryStore,
  useNeuronStore,
  useSpotlightStore,
  useSynapseStore,
} from '@cosimosi/universe'

import { useUniverseScene, type UniverseSceneState } from './use-universe-scene.ts'

/**
 * The shared host core, which both apps' widgets now consume instead of each keeping a copy.
 *
 * What this pins is the one thing the fork had already got wrong on native (R006): a pick arrives as
 * an INSTANCE index and must resolve against the entity store the layer indexed its instances by —
 * NOT the projected graph. The two diverge by exactly one row after a launch, and it is the row a
 * person reaches for first.
 */
const EMOTION = { mood: 'JOY', valence: 0.5, arousal: 0.4, intensity: 0.6 } as const

const serverMemory = (id: string) => ({
  id,
  name: id,
  emotion: EMOTION,
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-07-01',
  activations: [],
})

const universeFixture = () => ({
  memories: [serverMemory('server-a'), serverMemory('server-b')],
  neurons: [{ id: 'neuron-1', name: 'sea', neuronType: 'semantic' as const, connectivity: 1 }],
  synapses: [],
  universeTime: '2026-07-01',
})

const serverStoredMemory = (id: string): EpisodicMemory => ({
  ...serverMemory(id),
  diaryId: `${id}-diary`,
  seed: null,
  lastRecalledUniverseTime: null,
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: id,
  semanticStage: 0,
})

/** The optimistic tail: a launch already put this in the store, the server read has not caught up. */
const optimisticMemory: EpisodicMemory = {
  ...serverStoredMemory('optimistic-c'),
  currentText: 'just written',
}

function mountScene(navigationActorRef: ReturnType<typeof createActor>) {
  const captured: { current: UniverseSceneState | null } = { current: null }

  function Probe() {
    captured.current = useUniverseScene({
      simSpawner: null,
      latentStarCount: 8,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigationActorRef: navigationActorRef as any,
    })
    return null
  }

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const view = render(
    <TransportProvider transport={createMemoryMockTransport(universeFixture)}>
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    </TransportProvider>,
  )
  return { captured, view }
}

describe('useUniverseScene — pick resolution (R006)', () => {
  beforeEach(() => {
    useEpisodicMemoryStore.getState().clear()
    useNeuronStore.getState().clear()
    useSynapseStore.getState().clear()
  })

  it('resolves a pick at the optimistic tail, which the projected graph does not carry', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)

    // The read lands first. (Seeding the store before it would prove nothing: while the query is
    // still loading `useUniverse` sees no universe and clears the mirrors, which is what keeps a
    // signed-out read from leaving the previous user's data on screen.)
    await waitFor(() =>
      expect(useEpisodicMemoryStore.getState().ids).toEqual(['server-a', 'server-b']),
    )

    // Then a launch appends the new memory to the store, the way the launch flow does — before any
    // refetch has brought it back from the server. Wrapped in `act` so the hook re-renders and the
    // pick callback closes over the grown id list; a stale closure would answer for two rows.
    act(() => {
      useEpisodicMemoryStore
        .getState()
        .setAll([...['server-a', 'server-b'].map(serverStoredMemory), optimisticMemory])
    })

    const scene = captured.current
    expect(scene).not.toBeNull()
    // The graph is built from the RESPONSE, so it holds two memories — index 2 does not exist there,
    // and resolving the pick through it would drop this tap entirely.
    expect(scene?.graph?.episodicMemories).toHaveLength(2)

    scene?.focusMemory(2)

    expect(actor.getSnapshot().context.selectedNodeId).toBe('optimistic-c')
    view.unmount()
    actor.stop()
  })

  it('leaves the selection alone for an index past every known slot', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)
    await waitFor(() => expect(captured.current?.graph).not.toBeNull())

    captured.current?.focusMemory(99)

    expect(actor.getSnapshot().context.selectedNodeId).toBeNull()
    view.unmount()
    actor.stop()
  })

  it('scatters the latent field at the count the platform asked for', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)
    await waitFor(() => expect(captured.current).not.toBeNull())

    // The one fidelity knob the native shell turns down; the seed stays shared so both platforms
    // scatter the same field, just less of it.
    expect(captured.current?.latentField.positions).toHaveLength(8 * 3)
    view.unmount()
    actor.stop()
  })
})

describe('useUniverseScene — what the pinned camera orbits', () => {
  beforeEach(() => {
    useEpisodicMemoryStore.getState().clear()
    useNeuronStore.getState().clear()
    useSynapseStore.getState().clear()
    useSpotlightStore.getState().clear()
  })

  it('holds the middle of the stars while nothing has taken the frame', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)
    await waitFor(() => expect(captured.current?.graph).not.toBeNull())
    // One inline sim step, so the coordinate buffer the centre is measured from exists.
    act(() => captured.current?.pump(1 / 60))

    const buffer = captured.current?.bridge.coordinates.current
    expect(buffer).toBeTruthy()
    const nodes = (buffer as Float32Array).length / 3
    const mean = (axis: number) => {
      let total = 0
      for (let i = 0; i < nodes; i++) total += (buffer as Float32Array)[i * 3 + axis] as number
      return total / nodes
    }

    const pinned = captured.current?.getPinnedView()
    expect(pinned?.held).toBe(false)
    expect(pinned?.center[0]).toBeCloseTo(mean(0), 5)
    expect(pinned?.center[1]).toBeCloseTo(mean(1), 5)
    expect(pinned?.center[2]).toBeCloseTo(mean(2), 5)
    view.unmount()
    actor.stop()
  })

  it('holds the selected star instead, and lets it go again when the selection is cleared', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)
    await waitFor(() => expect(captured.current?.graph).not.toBeNull())
    act(() => captured.current?.pump(1 / 60))
    const free = captured.current?.getPinnedView()
    const centroid = [free?.center[0], free?.center[1], free?.center[2]]

    act(() => actor.send({ type: 'SELECT', nodeId: 'server-a' }))

    const held = captured.current?.getPinnedView()
    expect(held?.held).toBe(true)
    const index = captured.current?.nodeIndex?.episodicMemories['server-a'] as number
    const buffer = captured.current?.bridge.coordinates.current as Float32Array
    expect(held?.center[0]).toBeCloseTo(buffer[index * 3] as number, 5)
    expect(held?.center[2]).toBeCloseTo(buffer[index * 3 + 2] as number, 5)

    // Leaving the star — the panel closing is a CLEAR_SELECTION — is what puts the middle of the
    // stars back in the middle of the frame; the rig reads this and glides home.
    act(() => actor.send({ type: 'CLEAR_SELECTION' }))

    const released = captured.current?.getPinnedView()
    expect(released?.held).toBe(false)
    expect(released?.center[0]).toBeCloseTo(centroid[0] as number, 5)
    view.unmount()
    actor.stop()
  })

  it('keeps holding while a spotlight is on, so an arrival is not slid away from', async () => {
    const actor = createActor(universeNavigationMachine).start()
    const { captured, view } = mountScene(actor)
    await waitFor(() => expect(captured.current?.graph).not.toBeNull())
    act(() => captured.current?.pump(1 / 60))

    act(() => useSpotlightStore.getState().spotlight(['server-b']))

    const held = captured.current?.getPinnedView()
    expect(held?.held).toBe(true)
    const index = captured.current?.nodeIndex?.episodicMemories['server-b'] as number
    const buffer = captured.current?.bridge.coordinates.current as Float32Array
    expect(held?.center[1]).toBeCloseTo(buffer[index * 3 + 1] as number, 5)
    view.unmount()
    actor.stop()
  })
})
