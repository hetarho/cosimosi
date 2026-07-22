import { createRouterTransport } from '@connectrpc/connect'
import { beforeEach, describe, expect, it } from 'vitest'

import { MemoryService } from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  applyReleaseResult,
  requestRelease,
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

describe('features/delete-memory api', () => {
  it('Release carries ONLY diary_id — no kind/emotion/position/color/strength/time field (A9)', async () => {
    let received: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        release(request) {
          received = { ...request }
          return { diaryId: request.diaryId, episodicMemoryIds: ['m1'], deletedAt: '2026-07-15' }
        },
      })
    })

    await requestRelease(transport, { diaryId: 'd1' })

    // The $typeName marker is the connect message tag, not a wire field; the true payload is the rest.
    const keys = Object.keys(received ?? {}).filter((key) => key !== '$typeName')
    expect(keys).toEqual(['diaryId'])
    expect(received?.diaryId).toBe('d1')
  })

  it('optimistically removes exactly the returned ids and records the restore group (A2)', async () => {
    useEpisodicMemoryStore.getState().setAll([memory('m1'), memory('m2'), memory('m3')])
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        release: () => ({
          diaryId: 'd1',
          episodicMemoryIds: ['m1', 'm2'],
          deletedAt: '2026-07-15T00:00:00Z',
        }),
      })
    })

    const response = await requestRelease(transport, { diaryId: 'd1' })
    applyReleaseResult(response)

    expect(useEpisodicMemoryStore.getState().ids).toEqual(['m3'])
    expect(useReleasedGroupsStore.getState().groups).toHaveLength(1)
  })

  it('a failed Release applies nothing — the stars remain (rollback, A2)', async () => {
    useEpisodicMemoryStore.getState().setAll([memory('m1'), memory('m2')])
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        release: () => {
          throw new Error('server refused')
        },
      })
    })

    await expect(requestRelease(transport, { diaryId: 'd1' })).rejects.toThrow()
    expect(useEpisodicMemoryStore.getState().ids).toEqual(['m1', 'm2'])
    expect(useReleasedGroupsStore.getState().groups).toHaveLength(0)
  })
})
