import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import {
  createGetUniverseQueryKey,
  type LetGoResponse,
  type SuggestLetGoResponse,
} from '@cosimosi/api-client'
import { requestLetGo, requestSuggestLetGo } from '../deletion.ts'

// features/let-go api step 1 ([X6]): SuggestLetGo over the generated client — the LLM-latency call
// that returns the this-memory-only semantic candidates + the heavy-state hint. It seals nothing.
export function useSuggestLetGo(): (
  episodicMemoryId: string,
  words: string,
) => Promise<SuggestLetGoResponse> {
  const transport = useTransport()
  return useCallback(
    (episodicMemoryId: string, words: string) =>
      requestSuggestLetGo(transport, { episodicMemoryId, words }),
    [transport],
  )
}

// features/let-go api step 2 ([X4][X5]): LetGo over the generated client. The seal is server-
// authoritative; the FE applies no optimistic mark — the sealed neuron simply drops from the next
// GetUniverse read, so the memory thins and re-settles then ([X4] allows the thinning to arrive on
// the next read). The read invalidation triggers that refetch (§2.8). A failed call throws and
// seals nothing.
export function useLetGo(): (
  episodicMemoryId: string,
  approvedNeuronIds: readonly string[],
) => Promise<LetGoResponse> {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(
    async (episodicMemoryId: string, approvedNeuronIds: readonly string[]) => {
      const response = await requestLetGo(transport, { episodicMemoryId, approvedNeuronIds })
      queryClient
        .invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) })
        .catch(() => undefined)
      return response
    },
    [transport, queryClient],
  )
}
