import { focusManager, type QueryClient, type QueryKey } from '@tanstack/query-core'

export interface RevisionGatedRefocusOptions<TData> {
  readonly queryClient: QueryClient
  /** The exact key of the one read this gate stands in front of. */
  readonly queryKey: QueryKey
  /** How long that read stays fresh; a refocus inside it costs nothing at all. */
  readonly staleTime: number
  /** The revision the cached data was read at. */
  readonly revisionOf: (data: TData) => bigint
  /** The server's current revision, read alone. */
  readonly readRevision: () => Promise<bigint>
}

/**
 * Refocus without the full download (CLIENT-39): when the window regains focus and the cached read
 * is past its stale time, read the revision alone and refetch only when it moved. The read itself
 * must opt out of `refetchOnWindowFocus`, or Query refetches before this gate is asked.
 *
 * Subscribes to Query's own focus source, so a platform that wires none (React Native) never fires
 * it. A failed revision read changes nothing; the next refocus asks again. Invalidation after a
 * mutation does not pass through here and still refetches as usual.
 */
export function subscribeRevisionGatedRefocus<TData>(
  options: RevisionGatedRefocusOptions<TData>,
): () => void {
  const { queryClient, queryKey, staleTime, revisionOf, readRevision } = options
  let checking = false
  let active = true
  const unsubscribe = focusManager.subscribe((focused) => {
    if (!focused || checking) return
    const query = queryClient.getQueryCache().find<TData>({ queryKey, exact: true })
    const cached = query?.state.data
    if (!query || cached === undefined || !query.isStaleByTime(staleTime)) return
    checking = true
    void readRevision()
      .then((revision) => {
        if (!active || revision === revisionOf(cached)) return
        return queryClient.refetchQueries({ queryKey, exact: true })
      })
      .catch(() => undefined)
      .finally(() => {
        checking = false
      })
  })
  return () => {
    // A pending revision may outlive its event subscription.
    active = false
    unsubscribe()
  }
}
