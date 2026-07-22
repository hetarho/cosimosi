import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import {
  createGetDiariesInfiniteQueryKey,
  createGetDiariesQueryKey,
  createGetUniverseQueryKey,
  type ReleaseResponse,
} from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { applyReleaseResult, requestRelease } from '../deletion.ts'

// features/delete-memory api ([X1][X2]): the single Release call over the generated client. On
// success the returned ids are optimistically removed from the episodic-memory mirror and the
// group is recorded for restore (applyReleaseResult); a failed call throws and applies nothing, so
// the caller keeps the confirm open (retriable). The read invalidations let the canvas + archive
// re-settle authoritatively on the next read (§2.8 — no polling). Stable identity for effect deps.
export function useReleaseMemory(): (diaryId: string) => Promise<ReleaseResponse> {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(
    async (diaryId: string) => {
      const response = await requestRelease(transport, { diaryId })
      applyReleaseResult(response)
      queryClient
        .invalidateQueries({ queryKey: createGetUniverseQueryKey(transport) })
        .catch(() => undefined)
      queryClient
        .invalidateQueries({ queryKey: createGetDiariesQueryKey(transport) })
        .catch(() => undefined)
      // The reader reads the archive through the INFINITE query — invalidate that key too, or its
      // live-memory chips + delete action stay stale after a release.
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
