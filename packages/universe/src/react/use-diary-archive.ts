import { useCallback, useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useInfiniteQuery } from '@tanstack/react-query'

import { createGetDiariesInfiniteQueryOptions, type GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { diariesFromDtos, type Diary } from '@cosimosi/memory'

import { useDiaryStore } from '../diary-store.ts'

export interface DiaryArchive {
  diaries: readonly Diary[]
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => void
}

// features/read-diary-list api ([D2]): the free GetDiaries archive read, paginated in the
// requested chronological direction. page_size comes from config (never hardcoded); the next page loads
// lazily off next_page_token. Every resolution maps DTO→domain and fills the shared diary
// read-model. Free — no clock, no Twinkle (§2.7 GET-eligible); only the jump spends.
export interface DiaryArchiveOptions {
  /** A read that is only wanted once something asks for it — a day picked on the calendar. Disabled,
   *  it issues nothing and reports an empty archive rather than a pending one. */
  enabled?: boolean
  /**
   * Whether this read OWNS the shared diary mirror. Exactly one read on a screen may: owning it is a
   * replace, so a second, narrower read owning it too would erase the first's page. A read that does
   * not own it still contributes its entries, because anything looked up by id — the deletion
   * confirm's affected-star list — has to be able to find a diary this screen is showing.
   */
  mirror?: boolean
}

export function useDiaryArchive(
  input: GetDiariesInput = {},
  { enabled = true, mirror = true }: DiaryArchiveOptions = {},
): DiaryArchive {
  const transport = useTransport()
  const query = useInfiniteQuery({
    ...createGetDiariesInfiniteQueryOptions(transport, {
      ...input,
      pageSize: VALUES.diaryReader.pageSize,
    }),
    enabled,
  })
  const diaries = useMemo(
    () => diariesFromDtos((query.data?.pages ?? []).flatMap((page) => page.diaries)),
    [query.data],
  )
  useEffect(() => {
    const store = useDiaryStore.getState()
    if (mirror) store.setAll(diaries)
    else if (diaries.length > 0) store.add(diaries)
  }, [diaries, mirror])
  // Deliberately re-created per render (useInfiniteQuery returns a fresh result object): a consumer
  // whose scroll observer depends on this identity re-attaches after every commit, which is what lets
  // it pick the sentinel back up once the loading state clears. Memoizing this would remove that.
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
