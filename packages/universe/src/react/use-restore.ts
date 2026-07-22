import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import {
  createGetDiariesInfiniteQueryKey,
  createGetDiariesQueryKey,
  createGetUniverseQueryKey,
  type RestoreResponse,
} from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { applyRestoreResult, requestRestore } from '../deletion.ts'

// features/restore-memory api ([X2]): the single Restore call over the generated client. On success
// the group's captured snapshots are re-inserted into the episodic-memory mirror and the group is
// dropped (applyRestoreResult); the full graph re-settles on the next read (§2.8 — no polling). A
// failed call throws and applies nothing, so the group stays listed and the caller can retry.
export function useRestoreMemory(): (diaryId: string) => Promise<RestoreResponse> {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(
    async (diaryId: string) => {
      const response = await requestRestore(transport, { diaryId })
      applyRestoreResult(diaryId)
      queryClient
        .invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) })
        .catch(() => undefined)
      queryClient
        .invalidateQueries({ queryKey: createGetDiariesQueryKey(transport) })
        .catch(() => undefined)
      // The reader reads the archive through the INFINITE query — invalidate that key too so the
      // restored diary's chips + actions reappear.
      queryClient
        .invalidateQueries({
          queryKey: createGetDiariesInfiniteQueryKey(transport, VALUES.diaryReader.pageSize),
        })
        .catch(() => undefined)
      return response
    },
    [transport, queryClient],
  )
}
