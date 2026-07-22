import { createRouterTransport } from '@connectrpc/connect'
import { beforeEach, describe, expect, it } from 'vitest'

import { MemoryService } from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  applyRestoreResult,
  requestRestore,
  useEpisodicMemoryStore,
  useReleasedGroupsStore,
} from '@cosimosi/universe'

const memory = (id: string): EpisodicMemory => ({
  id,
  name: id,
  emotion: { mood: 'JOY', valence: 0.5, arousal: 0.5, intensity: 0.5 },
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-07-01',
  lastRecalledUniverseTime: null,
  seed: null,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: id,
  semanticStage: 0,
})

beforeEach(() => {
  useEpisodicMemoryStore.getState().setAll([])
  useReleasedGroupsStore.getState().reset()
})

describe('features/restore-memory api', () => {
  it('Restore carries ONLY diary_id (A9)', async () => {
    let received: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        restore(request) {
          received = { ...request }
          return { diaryId: request.diaryId, episodicMemoryIds: ['m1'] }
        },
      })
    })

    await requestRestore(transport, { diaryId: 'd1' })

    const keys = Object.keys(received ?? {}).filter((key) => key !== '$typeName')
    expect(keys).toEqual(['diaryId'])
  })

  it('re-inserts the released group’s stars and drops the group (A3)', async () => {
    useEpisodicMemoryStore.getState().setAll([memory('m3')])
    useReleasedGroupsStore.getState().record({
      diaryId: 'd1',
      deletedAt: '2026-07-15T00:00:00Z',
      episodicMemoryIds: ['m1', 'm2'],
      removedMemories: [memory('m1'), memory('m2')],
    })
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        restore: () => ({ diaryId: 'd1', episodicMemoryIds: ['m1', 'm2'] }),
      })
    })

    await requestRestore(transport, { diaryId: 'd1' })
    applyRestoreResult('d1')

    expect([...useEpisodicMemoryStore.getState().ids].sort()).toEqual(['m1', 'm2', 'm3'])
    expect(useReleasedGroupsStore.getState().groups).toHaveLength(0)
  })
})
