import { useEffect, useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'

import { createGetDiaryCalendarInfiniteQueryOptions } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { diaryDaysFromDtos } from '@cosimosi/memory'

import { monthDateRange, monthMarks, stepMonth, type DayMark } from '../diary-calendar.ts'

export interface DiaryCalendarMonth {
  /** The month's written days, keyed `YYYY-MM-DD`. Empty until the month is fully paged. */
  marks: ReadonlyMap<string, DayMark>
  isLoading: boolean
  isError: boolean
}

const EMPTY_MARKS: ReadonlyMap<string, DayMark> = new Map()

// widgets/diary-calendar api ([D12]): the free GetDiaryCalendar month read. The requested range is the
// DISPLAYED MONTH ONLY, never the 4–6 week grid span: calendar_month_page_size is sized so one civil
// month resolves in a single round trip, and a grid-span request (up to 42 days) would guarantee a second
// page for every month. Out-of-month grid cells therefore carry no mark, which is also what A2 asks for.
//
// Free and time-frozen — no clock, no Twinkle, no consent (§2.7 GET-eligible, [D11][T3]). Freshness is by
// invalidation only; there is no interval and no refetch loop here (§3.2).
// `enabled` is how the caller says the calendar is actually on screen. The reader mounts this hook in both
// of its views (the toggle lives above the branch), so without the gate every visit to the archive would
// issue a month read nobody asked to see.
export function useDiaryCalendar(month: string, enabled = true): DiaryCalendarMonth {
  const transport = useTransport()
  const queryClient = useQueryClient()
  const range = useMemo(() => monthDateRange(month), [month])
  const active = enabled && range !== null

  const query = useInfiniteQuery({
    ...createGetDiaryCalendarInfiniteQueryOptions(transport, {
      from: range?.from ?? '',
      to: range?.to ?? '',
    }),
    enabled: active,
    // Shorter than the shared client_cache default: the marks are derived from live memory strength, so
    // entering the calendar after letting go in another view must refetch rather than paint a stale month.
    staleTime: VALUES.diaryReader.calendarStaleMs,
  })

  // Page to the end of the month before anything is shown. A half-paged month would compute the WRONG
  // representative — a missing high-weight mood silently promotes the runner-up — so the loading state is
  // held until next_page_token is empty rather than briefly showing a wrong color.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    if (!active || !hasNextPage || isFetchingNextPage) return
    fetchNextPage().catch(() => undefined)
  }, [active, hasNextPage, isFetchingNextPage, fetchNextPage])

  const marks = useMemo(() => {
    if (query.hasNextPage) return EMPTY_MARKS
    const days = (query.data?.pages ?? []).flatMap((page) => page.days)
    return monthMarks(diaryDaysFromDtos(days))
  }, [query.data, query.hasNextPage])

  // Prefetch the neighbours prev/next can reach, so a step does not flash a loading grid. 0 prefetches
  // nothing. Only the first page is warmed — a month that needs a second one still pages on arrival.
  const prefetchCount = VALUES.diaryReader.calendarPrefetchMonths
  useEffect(() => {
    if (!active || prefetchCount <= 0) return
    for (let distance = 1; distance <= prefetchCount; distance++) {
      for (const delta of [-distance, distance]) {
        const neighbour = monthDateRange(stepMonth(month, delta))
        if (!neighbour) continue
        queryClient
          .prefetchInfiniteQuery({
            ...createGetDiaryCalendarInfiniteQueryOptions(transport, {
              from: neighbour.from,
              to: neighbour.to,
            }),
            staleTime: VALUES.diaryReader.calendarStaleMs,
          })
          .catch(() => undefined)
      }
    }
  }, [month, active, prefetchCount, queryClient, transport])

  return {
    marks,
    // `hasNextPage` keeps this true through the middle pages, which is the point: a partially paged month
    // reports loading, never marks.
    isLoading: active ? query.isLoading || query.hasNextPage : false,
    isError: query.isError,
  }
}
