import { useCallback, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createAchievementServiceQueryKey,
  createListAchievementsQueryOptions,
} from '@cosimosi/api-client'

import { toAchievementView, type AchievementView } from '../achievement.ts'

// The one read. It answers the WHOLE catalog with this caller's progress in the server's fixed order,
// so nothing here sorts, filters or evaluates — the hook's only job is the proto→domain mapping.
//
// No polling and no subscription (§2.8): the list refetches when an action that could have recorded
// progress resolves, through useInvalidateAchievements below.
export function useAchievements() {
  const transport = useTransport()
  const query = useQuery(createListAchievementsQueryOptions(transport))
  const entries = useMemo<readonly AchievementView[]>(
    () => (query.data?.entries ?? []).map(toAchievementView),
    [query.data],
  )
  // The named fields are picked rather than spread. Spreading the query result reads every one of
  // TanStack's tracked getters, which marks them all as observed — so a background refetch that only
  // moved `isFetching` would re-render the whole list even though `entries` is the same reference.
  return { entries, isPending: query.isPending, isSuccess: query.isSuccess, error: query.error }
}

// The refetch seam every in-session progress-recording resolution calls. Stable identity so callers
// can list it in effect/callback deps without churn.
export function useInvalidateAchievements() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: createAchievementServiceQueryKey() })
      .catch(() => undefined)
  }, [queryClient])
}
