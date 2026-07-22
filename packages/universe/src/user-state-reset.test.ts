import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { useAdvanceAnnouncementStore } from './advance-announcement-store.ts'
import { useAwakenRegistryStore } from './awaken-registry.ts'
import { useDeletionDraftStore } from './deletion-draft-store.ts'
import { useDeletionTargetStore } from './deletion-target-store.ts'
import { useDiaryDraftStore } from './diary-draft-store.ts'
import { useDiaryStore } from './diary-store.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useLatentConsumedStore } from './latent-consumed-store.ts'
import { useLaunchedNeuronsStore } from './launched-neurons-store.ts'
import { useNeuronStore } from './neuron-store.ts'
import { useOpenDiaryTargetStore } from './open-diary-target-store.ts'
import { usePendingFlyTargetStore } from './pending-fly-target-store.ts'
import { useProposalStore } from './proposal-store.ts'
import { useRecallDraftStore } from './recall-draft-store.ts'
import { useRecallTargetStore } from './recall-target-store.ts'
import { useReleasedGroupsStore } from './released-groups-store.ts'
import { useSynapseStore } from './synapse-store.ts'
import { useTimeSyncConsentStore } from './time-sync-consent-store.ts'
import { useUniverseClockStore } from './universe-clock-store.ts'
import { resetUniverseUserState } from './user-state-reset.ts'

describe('resetUniverseUserState', () => {
  it('clears every package-owned user mirror and cross-route channel', async () => {
    useEpisodicMemoryStore.setState({ byId: { memory: {} as never }, ids: ['memory'] })
    useNeuronStore.setState({ byId: { neuron: {} as never }, ids: ['neuron'] })
    useSynapseStore.setState({ byId: { synapse: {} as never }, ids: ['synapse'] })
    useUniverseClockStore.setState({ currentUniverseTime: '2026-07-22' })
    useDiaryStore.setState({ byId: { diary: {} as never }, ids: ['diary'] })
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
    useDeletionTargetStore.setState({ target: { mode: 'delete', diaryId: 'diary' } })
    useLatentConsumedStore.setState({ consumed: new Set([4]) })
    useAwakenRegistryStore.setState({ claimed: new Set(['neuron']) })
    useAdvanceAnnouncementStore.setState({
      pending: {
        interval: { previous: '2026-07-21', current: '2026-07-22' },
        revealNeuronIds: ['neuron'],
      },
    })
    useLaunchedNeuronsStore.setState({ newNeuronIds: ['neuron'] })
    useDiaryDraftStore.setState({ body: 'private diary', diaryDate: '2026-07-22' })
    useProposalStore.setState({ memories: [{} as never] })
    useRecallDraftStore.setState({ rewrite: 'private rewrite', result: {} as never })
    useDeletionDraftStore.setState({
      phrase: 'private phrase',
      candidates: [{} as never],
      selectedNeuronIds: ['neuron'],
      heavyDetected: true,
    })
    const pendingConsent = useTimeSyncConsentStore.getState().request()

    resetUniverseUserState()

    expect(useEpisodicMemoryStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useNeuronStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useSynapseStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull()
    expect(useDiaryStore.getState()).toMatchObject({ byId: {}, ids: [] })
    expect(useReleasedGroupsStore.getState().groups).toEqual([])
    expect(useRecallTargetStore.getState().memoryId).toBeNull()
    expect(useOpenDiaryTargetStore.getState().memoryId).toBeNull()
    expect(usePendingFlyTargetStore.getState().nodeId).toBeNull()
    expect(useDeletionTargetStore.getState().target).toBeNull()
    expect(useLatentConsumedStore.getState().consumed.size).toBe(0)
    expect(useAwakenRegistryStore.getState().claimed.size).toBe(0)
    expect(useAdvanceAnnouncementStore.getState().pending).toBeNull()
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual([])
    expect(useDiaryDraftStore.getState()).toMatchObject({ body: '', diaryDate: '' })
    expect(useProposalStore.getState().memories).toEqual([])
    expect(useRecallDraftStore.getState()).toMatchObject({ rewrite: '', result: null })
    expect(useDeletionDraftStore.getState()).toMatchObject({
      phrase: '',
      candidates: [],
      selectedNeuronIds: [],
      heavyDetected: false,
    })
    expect(useTimeSyncConsentStore.getState().pending).toBeNull()
    await expect(pendingConsent).resolves.toBe('cancel')
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
