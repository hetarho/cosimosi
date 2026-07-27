import { useEffect, useRef } from 'react'

import { groupLedgerByDay } from '@cosimosi/twinkle'
import { useTwinkleLedgerInfiniteQuery } from '@cosimosi/twinkle/react'

import { m } from '../../../shared/i18n/index.ts'
import { LedgerEntryRow } from './LedgerEntryRow.tsx'
import { TwinkleRefillMarker } from './TwinkleRefillMarker.tsx'

// The history: newest first, grouped under day headers, keyset-paged with an IntersectionObserver
// sentinel. No virtualization library — this is the first list in the product to need the mechanic and
// a ledger page is small; the diary list follows the same shape later.
//
// The day headers come from the server-supplied `occurredOn`, already resolved in the user's timezone.
// The client performs no timezone arithmetic ([U7]): a device-local grouping would draw headers that
// disagree with the SMALL reset boundary the same user just watched refill.
export function TwinkleLedgerList() {
  const query = useTwinkleLedgerInfiniteQuery()
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Depend on the STABLE fetcher, not on `query`: the query object is a new reference every render, so
  // including it would tear down and rebuild the observer continuously. `canLoadMore` going false while a
  // page is in flight is what keeps one intersection from firing a second fetch.
  const canLoadMore = query.hasNextPage && !query.isFetchingNextPage
  const fetchNextPage = query.fetchNextPage
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !canLoadMore) return
    const observer = new IntersectionObserver((visible) => {
      if (visible.some((entry) => entry.isIntersecting)) {
        fetchNextPage().catch(() => undefined)
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMore, fetchNextPage])

  const entries = query.data?.pages.flatMap((page) => page.entries) ?? []
  const days = groupLedgerByDay(entries)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-text">{m.me_stardust_history_title()}</h3>
      {/* The refill is stated before the history, always — an account with no rows at all still has
          today's 작은 별가루, so this surface is never bare ([G5]). */}
      <TwinkleRefillMarker />
      {days.map((day) => (
        <div key={`${day.occurredOn}-${day.entries[0]?.id ?? ''}`} className="flex flex-col gap-1">
          <h4 className="text-xs text-text-muted tabular-nums">{day.occurredOn}</h4>
          <ul className="flex flex-col">
            {day.entries.map((entry) => (
              <LedgerEntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </div>
      ))}
      {query.isPending ? (
        <p className="text-sm text-text-muted">{m.me_stardust_history_loading()}</p>
      ) : null}
      {/* A failed read is NOT an empty history. Saying "nothing has come or gone" when the request
          broke would tell the reader their record is gone, which is the one thing it never is ([I1]). */}
      {query.isError ? (
        <p className="text-sm text-text-muted">{m.me_stardust_history_error()}</p>
      ) : null}
      {!query.isPending && !query.isError && entries.length === 0 ? (
        <p className="text-sm text-text-muted">{m.me_stardust_history_empty()}</p>
      ) : null}
      <div ref={sentinelRef} aria-hidden />
    </section>
  )
}
