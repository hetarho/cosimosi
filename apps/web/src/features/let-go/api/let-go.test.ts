import { createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it } from 'vitest'

import { MemoryService } from '@cosimosi/api-client'
import { requestLetGo, requestSuggestLetGo } from '@cosimosi/universe'

describe('features/let-go api', () => {
  it('SuggestLetGo returns this-memory-only candidates + the heavy-state hint; it seals nothing (A4/A8)', async () => {
    let sealed = false
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        suggestLetGo: (request) => ({
          candidates: [
            { neuronId: 'n1', name: 'the argument', reason: `only ${request.episodicMemoryId}` },
            { neuronId: 'n2', name: 'the rain', reason: 'only this memory' },
          ],
          heavyState: { detected: true, severity: 'elevated' },
        }),
        letGo: () => {
          sealed = true
          return { sealedNeuronIds: [] }
        },
      })
    })

    const response = await requestSuggestLetGo(transport, {
      episodicMemoryId: 'm1',
      words: 'let this go',
    })

    expect(response.candidates.map((c) => c.neuronId)).toEqual(['n1', 'n2'])
    expect(response.heavyState?.detected).toBe(true)
    // Suggesting seals nothing — no LetGo is issued by this call.
    expect(sealed).toBe(false)
  })

  it('LetGo sends ONLY the episodic memory id + the toggled approved subset (A4/A6/A9)', async () => {
    let received: Record<string, unknown> | undefined
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        letGo(request) {
          received = { ...request }
          return { sealedNeuronIds: [...request.approvedNeuronIds] }
        },
      })
    })

    // The diarist toggled off n2, approving only n1.
    await requestLetGo(transport, { episodicMemoryId: 'm1', approvedNeuronIds: ['n1'] })

    const keys = Object.keys(received ?? {}).filter((key) => key !== '$typeName')
    expect(keys.sort()).toEqual(['approvedNeuronIds', 'episodicMemoryId'])
    expect(received?.episodicMemoryId).toBe('m1')
    expect(received?.approvedNeuronIds).toEqual(['n1'])
  })

  it('a failed LetGo rejects and commits nothing (A5)', async () => {
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        letGo: () => {
          throw new Error('server refused')
        },
      })
    })

    await expect(
      requestLetGo(transport, { episodicMemoryId: 'm1', approvedNeuronIds: ['n1'] }),
    ).rejects.toThrow()
  })
})
