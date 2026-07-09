import type { QueryClient, QueryKey, QueryState } from '@tanstack/query-core'

import { clientCacheTimings } from './defaults.ts'
import { assertClientCacheData } from './render-state.ts'

export interface OptimisticPatch<TData = unknown> {
  queryKey: QueryKey
  update(current: TData | undefined): TData | undefined
}

export type OptimisticSnapshot =
  | {
      queryKey: QueryKey
      exists: false
      state?: undefined
      data: undefined
    }
  | {
      queryKey: QueryKey
      exists: true
      state: QueryState<unknown, Error>
      data: unknown
    }

export interface BeginOptimisticMutationOptions {
  queryClient: QueryClient
  patches: readonly OptimisticPatch[]
  invalidate?: readonly QueryKey[]
  rollbackDelayMs?: number
}

export interface OptimisticMutationContext {
  snapshots: readonly OptimisticSnapshot[]
  rollbackDelayMs: number
  rollback(): void
  settle(): Promise<void>
}

export async function beginOptimisticMutation(
  options: BeginOptimisticMutationOptions,
): Promise<OptimisticMutationContext> {
  await Promise.all(
    options.patches.map((patch) => options.queryClient.cancelQueries({ queryKey: patch.queryKey })),
  )

  const snapshots = options.patches.map((patch) =>
    captureSnapshot(options.queryClient, patch.queryKey),
  )

  try {
    for (const patch of options.patches) {
      applyPatch(options.queryClient, patch)
    }
  } catch (error) {
    restoreSnapshots(options.queryClient, snapshots)
    throw error
  }

  return {
    snapshots,
    rollbackDelayMs: options.rollbackDelayMs ?? clientCacheTimings.optimisticRollbackMs,
    rollback() {
      restoreSnapshots(options.queryClient, snapshots)
    },
    async settle() {
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) =>
          options.queryClient.invalidateQueries({ queryKey }),
        ),
      )
    },
  }
}

function captureSnapshot(queryClient: QueryClient, queryKey: QueryKey): OptimisticSnapshot {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true })
  if (!query) {
    return { queryKey, exists: false, data: undefined }
  }
  const data = cloneCacheData(query.state.data)
  return {
    queryKey,
    exists: true,
    state: { ...query.state, data },
    data,
  }
}

function applyPatch(queryClient: QueryClient, patch: OptimisticPatch): void {
  const current = queryClient.getQueryData(patch.queryKey)
  const next = patch.update(current)
  assertClientCacheData(next)
  if (next === undefined) {
    queryClient.removeQueries({ queryKey: patch.queryKey, exact: true })
  } else {
    queryClient.setQueryData(patch.queryKey, next)
  }
}

function restoreSnapshots(
  queryClient: QueryClient,
  snapshots: readonly OptimisticSnapshot[],
): void {
  for (const snapshot of snapshots) {
    if (!snapshot.exists) {
      queryClient.removeQueries({ queryKey: snapshot.queryKey, exact: true })
    } else {
      const restoredState = cloneSnapshotState(snapshot)
      const query =
        queryClient.getQueryCache().find({ queryKey: snapshot.queryKey, exact: true }) ??
        queryClient
          .getQueryCache()
          .build(queryClient, { queryKey: snapshot.queryKey }, restoredState)
      query.setState(restoredState)
    }
  }
}

function cloneSnapshotState(
  snapshot: Extract<OptimisticSnapshot, { exists: true }>,
): QueryState<unknown, Error> {
  return {
    ...snapshot.state,
    data: cloneCacheData(snapshot.state.data),
  }
}

function cloneCacheData<T>(value: T): T {
  const structuredCloneFn = (globalThis as { structuredClone?: <TValue>(input: TValue) => TValue })
    .structuredClone
  if (structuredCloneFn) {
    try {
      return structuredCloneFn(value)
    } catch {
      return cloneCacheDataFallback(value)
    }
  }
  return cloneCacheDataFallback(value)
}

function cloneCacheDataFallback<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return new Date(value) as T
  if (value instanceof ArrayBuffer) return value.slice(0) as T
  if (ArrayBuffer.isView(value)) return cloneArrayBufferView(value) as T
  if (Array.isArray(value)) return value.map((item) => cloneCacheDataFallback(item)) as T
  if (value instanceof Map) {
    return new Map(
      Array.from(value.entries(), ([key, item]) => [
        cloneCacheDataFallback(key),
        cloneCacheDataFallback(item),
      ]),
    ) as T
  }
  if (value instanceof Set) {
    return new Set(Array.from(value.values(), (item) => cloneCacheDataFallback(item))) as T
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneCacheDataFallback(item)]),
  ) as T
}

function cloneArrayBufferView<T extends ArrayBufferView>(value: T): T {
  if (value instanceof DataView) {
    const copy = new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return new DataView(copy.buffer, copy.byteOffset, copy.byteLength) as unknown as T
  }
  return (value as T & { slice: () => T }).slice()
}
