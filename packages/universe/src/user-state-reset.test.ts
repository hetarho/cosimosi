import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { useAwakenRegistryStore } from './awaken-registry.ts'
import { useChargeRequestStore } from './charge-request-store.ts'
import { useDeletionTargetStore } from './deletion-target-store.ts'
import { useDiaryStore } from './diary-store.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useLatentConsumedStore } from './latent-consumed-store.ts'
import { useNeuronStore } from './neuron-store.ts'
import { useOpenDiaryTargetStore } from './open-diary-target-store.ts'
import { usePendingFlyTargetStore } from './pending-fly-target-store.ts'
import { useRecallTargetStore } from './recall-target-store.ts'
import { useReleasedGroupsStore } from './released-groups-store.ts'
import { useSynapseStore } from './synapse-store.ts'
import { useTwinkleBalanceStore } from './twinkle-balance-store.ts'
import { useUniverseClockStore } from './universe-clock-store.ts'
import { resetUniverseUserState } from './user-state-reset.ts'

describe('resetUniverseUserState', () => {
  it('clears every package-owned user mirror and cross-route channel', () => {
    useEpisodicMemoryStore.setState({ byId: { memory: {} as never }, ids: ['memory'] })
    useNeuronStore.setState({ byId: { neuron: {} as never }, ids: ['neuron'] })
    useSynapseStore.setState({ byId: { synapse: {} as never }, ids: ['synapse'] })
    useUniverseClockStore.setState({ currentUniverseTime: '2026-07-22' })
    useDiaryStore.setState({ byId: { diary: {} as never }, ids: ['diary'] })
    useTwinkleBalanceStore.setState({ basic: 3n, additional: 5n, loaded: true })
    useReleasedGroupsStore.setState({
      groups: [
        {
          diaryId: 'diary',
          deletedAt: '2026-07-22T00:00:00Z',
          episodicMemoryIds: ['memory'],
          removedMemories: [],
        },
      ],
    })
    useRecallTargetStore.setState({ memoryId: 'memory' })
    useOpenDiaryTargetStore.setState({ memoryId: 'memory' })
    usePendingFlyTargetStore.setState({ nodeId: 'memory' })
    useChargeRequestStore.setState({ requested: true })
    useDeletionTargetStore.setState({ target: { mode: 'delete', diaryId: 'diary' } })
    useLatentConsumedStore.setState({ consumed: new Set([4]) })
    useAwakenRegistryStore.setState({ claimed: new Set(['neuron']) })

    resetUniverseUserState()

    expect(useEpisodicMemoryStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useNeuronStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useSynapseStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull()
    expect(useDiaryStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useTwinkleBalanceStore.getState()).toMatchObject({
      basic: 0n,
      additional: 0n,
      loaded: false,
    })
    expect(useReleasedGroupsStore.getState().groups).toEqual([])
    expect(useRecallTargetStore.getState().memoryId).toBeNull()
    expect(useOpenDiaryTargetStore.getState().memoryId).toBeNull()
    expect(usePendingFlyTargetStore.getState().nodeId).toBeNull()
    expect(useChargeRequestStore.getState().requested).toBe(false)
    expect(useDeletionTargetStore.getState().target).toBeNull()
    expect(useLatentConsumedStore.getState().consumed.size).toBe(0)
    expect(useAwakenRegistryStore.getState().claimed.size).toBe(0)
  })

  it('keeps the web and mobile app reset inventories in parity', () => {
    const webSource = readFileSync(
      fileURLToPath(
        new URL('../../../apps/web/src/app/model/reset-user-state.ts', import.meta.url),
      ),
      'utf8',
    )
    const mobileSource = readFileSync(
      fileURLToPath(
        new URL('../../../apps/mobile/src/app/model/reset-user-state.ts', import.meta.url),
      ),
      'utf8',
    )

    expect(readInventory(webSource, 'WEB_USER_STATE_RESET_INVENTORY')).toEqual(
      readInventory(mobileSource, 'MOBILE_USER_STATE_RESET_INVENTORY'),
    )
  })
})

function readInventory(source: string, name: string): string[] {
  const match = source.match(new RegExp(`${name} = \\[(.*?)\\] as const`, 's'))
  if (!match) throw new Error(`Missing ${name}`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1])
}
