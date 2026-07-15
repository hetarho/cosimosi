import { useCallback, useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useInfiniteQuery } from '@tanstack/react-query'

import { createGetDiariesInfiniteQueryOptions } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

import { diariesFromDtos, fillDiaryStore, type Diary } from '../../../entities/diary/index.ts'

export interface DiaryArchive {
  diaries: readonly Diary[]
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => void
}

// features/read-diary-list api ([D2]): the free GetDiaries archive read, paginated
// reverse-chronological. page_size comes from config (never hardcoded); the next page loads
// lazily off next_page_token. Every resolution maps DTO→domain and fills the shared diary
// read-model. Free — no clock, no Twinkle (§2.7 GET-eligible); only the jump spends.
export function useDiaryArchive(): DiaryArchive {
  const transport = useTransport()
  const query = useInfiniteQuery(
    createGetDiariesInfiniteQueryOptions(transport, VALUES.diaryReader.pageSize),
  )
  const diaries = useMemo(
    () => diariesFromDtos((query.data?.pages ?? []).flatMap((page) => page.diaries)),
    [query.data],
  )
  useEffect(() => {
    fillDiaryStore(diaries)
  }, [diaries])
  const loadMore = useCallback(() => {
    query.fetchNextPage().catch(() => undefined)
  }, [query])
  return {
    diaries,
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore,
  }
}
