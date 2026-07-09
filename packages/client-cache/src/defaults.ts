import { QueryClient, type DefaultOptions, type QueryClientConfig } from '@tanstack/query-core'

import { VALUES } from '@cosimosi/config'

export interface ClientCacheTimings {
  defaultStaleMs: number
  defaultGcMs: number
  defaultRetryCount: number
  optimisticRollbackMs: number
}

export const clientCacheTimings: ClientCacheTimings = {
  defaultStaleMs: VALUES.clientCache.defaultStaleMs,
  defaultGcMs: VALUES.clientCache.defaultGcMs,
  defaultRetryCount: VALUES.clientCache.defaultRetryCount,
  optimisticRollbackMs: VALUES.clientCache.optimisticRollbackMs,
}

export interface ClientCacheQueryClientOptions extends Omit<QueryClientConfig, 'defaultOptions'> {
  defaultOptions?: DefaultOptions
  timings?: ClientCacheTimings
}

export function createClientCacheDefaultOptions(
  timings: ClientCacheTimings = clientCacheTimings,
): DefaultOptions {
  return {
    queries: {
      staleTime: timings.defaultStaleMs,
      gcTime: timings.defaultGcMs,
      retry: timings.defaultRetryCount,
    },
  }
}

export function createClientCacheQueryClient(
  options: ClientCacheQueryClientOptions = {},
): QueryClient {
  const { defaultOptions, timings, ...queryClientOptions } = options
  return new QueryClient({
    ...queryClientOptions,
    defaultOptions: mergeDefaultOptions(createClientCacheDefaultOptions(timings), defaultOptions),
  })
}

function mergeDefaultOptions(
  base: DefaultOptions,
  overrides: DefaultOptions | undefined,
): DefaultOptions {
  if (!overrides) return base
  const { queries: overrideQueries, mutations: overrideMutations, ...restOverrides } = overrides
  const mutations =
    base.mutations || overrideMutations ? { ...base.mutations, ...overrideMutations } : undefined
  return {
    ...base,
    ...restOverrides,
    queries: { ...base.queries, ...overrideQueries },
    ...(mutations ? { mutations } : {}),
  }
}
