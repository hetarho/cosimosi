import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import { createGetUniverseQueryKey } from '@cosimosi/api-client'

// The refetch-on-jump seam: a whole-diary recall reinforces stars server-side, so the recovered
// brightness surfaces on the next GetUniverse. It invalidates that read (no polling, §2.7) so the
// universe re-renders bright when the reader hands back to it. Stable identity for effect/callback deps.
export function useInvalidateUniverse() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) })
      .catch(() => undefined)
  }, [queryClient, transport])
}
