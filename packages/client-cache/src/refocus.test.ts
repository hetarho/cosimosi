import { focusManager, QueryObserver } from '@tanstack/query-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clientCacheTimings, createClientCacheQueryClient } from './defaults.ts'
import { subscribeRevisionGatedRefocus } from './refocus.ts'

interface Snapshot {
  readonly revision: bigint
  readonly read: number
}

const QUERY_KEY = ['universe'] as const

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function harness(serverRevision: { current: bigint }) {
  const queryClient = createClientCacheQueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
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
  const subscribeGate = () =>
    subscribeRevisionGatedRefocus<Snapshot>({
      queryClient,
      queryKey: QUERY_KEY,
      staleTime: clientCacheTimings.defaultStaleMs,
      revisionOf: (data) => data.revision,
      readRevision,
    })
  const unsubscribeGate = subscribeGate()
  return {
    queryClient,
    fetchUniverse,
    readRevision,
    subscribeGate,
    unsubscribeGate,
    unsubscribeObserver,
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

  it('does not refetch a fresh active replacement after its subscription is disposed', async () => {
    const run = harness({ current: 4n })
    const revision = deferred<bigint>()
    run.readRevision.mockReturnValueOnce(revision.promise)
    let unsubscribeReplacement: () => void = () => undefined
    try {
      await settled(run)
      const original = run.queryClient.getQueryCache().find({ queryKey: QUERY_KEY, exact: true })
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(1)

      run.unsubscribeGate()
      run.unsubscribeObserver()
      run.queryClient.clear()
      const fetchReplacement = vi.fn(async (): Promise<Snapshot> => ({ revision: 9n, read: 1 }))
      const replacementObserver = new QueryObserver(run.queryClient, {
        queryKey: QUERY_KEY,
        queryFn: fetchReplacement,
        refetchOnWindowFocus: false,
      })
      unsubscribeReplacement = replacementObserver.subscribe(() => undefined)
      await vi.waitFor(() => expect(fetchReplacement).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(replacementObserver.getCurrentResult().isFetching).toBe(false))
      const replacement = run.queryClient.getQueryCache().find({ queryKey: QUERY_KEY, exact: true })
      expect(replacement).not.toBe(original)
      expect(replacement?.isActive()).toBe(true)
      expect(replacement?.isStaleByTime(clientCacheTimings.defaultStaleMs)).toBe(false)

      revision.resolve(5n)
      await vi.runOnlyPendingTimersAsync()
      expect(fetchReplacement).toHaveBeenCalledTimes(1)
      expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
      expect(run.queryClient.getQueryData(QUERY_KEY)).toEqual({ revision: 9n, read: 1 })
    } finally {
      unsubscribeReplacement()
      run.dispose()
    }
  })

  it('does not refetch a retained inactive query after its subscription is disposed', async () => {
    const server = { current: 4n }
    const run = harness(server)
    const revision = deferred<bigint>()
    run.readRevision.mockReturnValueOnce(revision.promise)
    try {
      await settled(run)
      const original = run.queryClient.getQueryCache().find({ queryKey: QUERY_KEY, exact: true })
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(1)
      run.unsubscribeGate()
      run.unsubscribeObserver()
      expect(run.queryClient.getQueryCache().find({ queryKey: QUERY_KEY, exact: true })).toBe(
        original,
      )
      expect(original?.getObserversCount()).toBe(0)

      server.current = 5n
      revision.resolve(5n)
      await vi.runOnlyPendingTimersAsync()
      expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
      expect(run.queryClient.getQueryData(QUERY_KEY)).toEqual({ revision: 4n, read: 1 })
    } finally {
      run.dispose()
    }
  })

  it('keeps one pending revision check and refetches when its live reply changes', async () => {
    const server = { current: 4n }
    const run = harness(server)
    const revision = deferred<bigint>()
    run.readRevision.mockReturnValueOnce(revision.promise)
    try {
      await settled(run)
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      await refocus()
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(1)
      expect(run.fetchUniverse).toHaveBeenCalledTimes(1)

      server.current = 5n
      revision.resolve(5n)
      await vi.runOnlyPendingTimersAsync()
      expect(run.fetchUniverse).toHaveBeenCalledTimes(2)
      expect(run.queryClient.getQueryData<Snapshot>(QUERY_KEY)?.revision).toBe(5n)
    } finally {
      run.dispose()
    }
  })

  it('handles a rejected pending revision after disposal without another read', async () => {
    const run = harness({ current: 4n })
    const revision = deferred<bigint>()
    run.readRevision.mockReturnValueOnce(revision.promise)
    try {
      await settled(run)
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(1)
      run.unsubscribeGate()
      revision.reject(new Error('offline'))
      await vi.runOnlyPendingTimersAsync()
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(1)
      expect(run.fetchUniverse).toHaveBeenCalledTimes(1)
    } finally {
      run.dispose()
    }
  })

  it('lets a new subscription refetch independently while an old reply is pending', async () => {
    const server = { current: 4n }
    const run = harness(server)
    const oldRevision = deferred<bigint>()
    const newRevision = deferred<bigint>()
    run.readRevision
      .mockReturnValueOnce(oldRevision.promise)
      .mockReturnValueOnce(newRevision.promise)
    let unsubscribeNew: () => void = () => undefined
    try {
      await settled(run)
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      await refocus()
      run.unsubscribeGate()
      unsubscribeNew = run.subscribeGate()
      await refocus()
      expect(run.readRevision).toHaveBeenCalledTimes(2)
      oldRevision.resolve(4n)
      await vi.runOnlyPendingTimersAsync()
      expect(run.fetchUniverse).toHaveBeenCalledTimes(1)

      server.current = 5n
      newRevision.resolve(5n)
      await vi.runOnlyPendingTimersAsync()
      expect(run.fetchUniverse).toHaveBeenCalledTimes(2)
      expect(run.queryClient.getQueryData<Snapshot>(QUERY_KEY)?.revision).toBe(5n)
    } finally {
      unsubscribeNew()
      run.dispose()
    }
  })

  it('leaves a full fetch already dispatched by the live subscription running', async () => {
    const server = { current: 4n }
    const run = harness(server)
    const fullReply = deferred<Snapshot>()
    try {
      await settled(run)
      await vi.advanceTimersByTimeAsync(clientCacheTimings.defaultStaleMs + 1_000)
      server.current = 5n
      run.fetchUniverse.mockImplementationOnce(() => fullReply.promise)
      await refocus()
      expect(run.fetchUniverse).toHaveBeenCalledTimes(2)
      expect(run.queryClient.getQueryState(QUERY_KEY)?.fetchStatus).toBe('fetching')
      run.unsubscribeGate()

      fullReply.resolve({ revision: 5n, read: 2 })
      await vi.runOnlyPendingTimersAsync()
      expect(run.queryClient.getQueryState(QUERY_KEY)?.fetchStatus).toBe('idle')
      expect(run.queryClient.getQueryData(QUERY_KEY)).toEqual({ revision: 5n, read: 2 })
    } finally {
      run.dispose()
    }
  })
})
