import { focusManager, QueryObserver } from '@tanstack/query-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clientCacheTimings, createClientCacheQueryClient } from './defaults.ts'
import { subscribeRevisionGatedRefocus } from './refocus.ts'

interface Snapshot {
  readonly revision: bigint
  readonly read: number
}

const QUERY_KEY = ['universe'] as const

function harness(serverRevision: { current: bigint }) {
  const queryClient = createClientCacheQueryClient()
  let reads = 0
  const fetchUniverse = vi.fn(async (): Promise<Snapshot> => ({
    revision: serverRevision.current,
    read: ++reads,
  }))
  const readRevision = vi.fn(async () => serverRevision.current)
  // An active observer, the way a mounted universe screen holds the read.
  const observer = new QueryObserver(queryClient, {
    queryKey: QUERY_KEY,
    queryFn: fetchUniverse,
    refetchOnWindowFocus: false,
  })
  const unsubscribeObserver = observer.subscribe(() => undefined)
  const unsubscribeGate = subscribeRevisionGatedRefocus<Snapshot>({
    queryClient,
    queryKey: QUERY_KEY,
    staleTime: clientCacheTimings.defaultStaleMs,
    revisionOf: (data) => data.revision,
    readRevision,
  })
  return {
    queryClient,
    fetchUniverse,
    readRevision,
    dispose() {
      unsubscribeGate()
      unsubscribeObserver()
      queryClient.clear()
    },
  }
}

// The first read has landed: a fetch still in flight would absorb a later one instead of repeating it.
async function settled(run: ReturnType<typeof harness>) {
  await vi.waitFor(() => expect(run.queryClient.getQueryData(QUERY_KEY)).toBeDefined())
  expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
}

async function refocus() {
  focusManager.setFocused(false)
  focusManager.setFocused(true)
  await vi.runOnlyPendingTimersAsync()
}

describe('subscribeRevisionGatedRefocus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  })

  it('reads only the revision when it did not move past the stale time', async () => {
    const server = { current: 4n }
    const run = harness(server)
    await settled(run)

    await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
    await refocus()

    expect(run.readRevision).toHaveBeenCalledTimes(1)
    expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
    run.dispose()
  })

  it('refetches the full read when the revision moved', async () => {
    const server = { current: 4n }
    const run = harness(server)
    await settled(run)

    server.current = 5n
    await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
    await refocus()

    await vi.waitFor(() => expect(run.fetchUniverse).toHaveBeenCalledTimes(2))
    expect(run.queryClient.getQueryData<Snapshot>(QUERY_KEY)?.revision).toBe(5n)
    run.dispose()
  })

  it('asks nothing while the read is still fresh', async () => {
    const run = harness({ current: 4n })
    await settled(run)

    await refocus()

    expect(run.readRevision).not.toHaveBeenCalled()
    expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
    run.dispose()
  })

  it('leaves a mutation invalidation refetching the full read', async () => {
    const run = harness({ current: 4n })
    await settled(run)

    await run.queryClient.invalidateQueries({ queryKey: QUERY_KEY })

    expect(run.fetchUniverse).toHaveBeenCalledTimes(2)
    expect(run.readRevision).not.toHaveBeenCalled()
    run.dispose()
  })

  it('treats a failed revision read as no news', async () => {
    const run = harness({ current: 4n })
    await settled(run)
    run.readRevision.mockRejectedValueOnce(new Error('offline'))

    await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
    await refocus()

    expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
    run.dispose()
  })
})
