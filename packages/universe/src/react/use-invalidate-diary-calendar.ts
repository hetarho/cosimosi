import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import { createGetDiaryCalendarInfiniteQueryKey } from '@cosimosi/api-client'

// The calendar's single refetch seam ([D12]): the key lives here and nowhere else, so the three archive
// mutations that can change a day's mark cannot drift apart on which key they refresh. The key omits the
// month, so one call refreshes every cached month — a release removes a day the user may not be looking at.
// Invalidation only, never polling (§3.2). Stable identity for effect/callback deps.
export function useInvalidateDiaryCalendar() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: createGetDiaryCalendarInfiniteQueryKey(transport) })
      .catch(() => undefined)
  }, [queryClient, transport])
}
