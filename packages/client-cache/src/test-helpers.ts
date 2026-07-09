import type { Transport } from '@connectrpc/connect'
import type { QueryClient, QueryKey } from '@tanstack/query-core'

import { createPlatformMockTransport, createPlatformPingQueryOptions } from '@cosimosi/api-client'

import { createClientCacheQueryClient, type ClientCacheQueryClientOptions } from './defaults.ts'
import { assertClientCacheData } from './render-state.ts'

export interface ClientCacheInspectionEntry {
  queryHash: string
  queryKey: QueryKey
  status: string
  dataUpdatedAt: number
}

export interface ClientCacheTestContextOptions {
  ping?: () => { message: string; requestId?: string; serverTime?: Date }
  queryClient?: QueryClient
  queryClientOptions?: ClientCacheQueryClientOptions
  transport?: Transport
}

export function createClientCacheTestContext(options: ClientCacheTestContextOptions = {}) {
  const transport =
    options.transport ?? createPlatformMockTransport(options.ping ?? (() => ({ message: 'pong' })))
  const queryClient =
    options.queryClient ?? createClientCacheQueryClient(options.queryClientOptions)
  return {
    queryClient,
    transport,
    platform: {
      pingQueryOptions: () => createPlatformPingQueryOptions(transport),
    },
    inspectCache: () => inspectClientCache(queryClient),
  }
}

export function inspectClientCache(queryClient: QueryClient): ClientCacheInspectionEntry[] {
  return queryClient
    .getQueryCache()
    .findAll()
    .map((query) => ({
      queryHash: query.queryHash,
      queryKey: query.queryKey,
      status: query.state.status,
      dataUpdatedAt: query.state.dataUpdatedAt,
    }))
}

export function setClientCacheData<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: TData | undefined | ((current: TData | undefined) => TData | undefined),
): TData | undefined {
  const current = queryClient.getQueryData<TData>(queryKey)
  const next =
    typeof updater === 'function'
      ? (updater as (current: TData | undefined) => TData | undefined)(current)
      : updater
  assertClientCacheData(next)
  if (next === undefined) {
    queryClient.removeQueries({ queryKey, exact: true })
  } else {
    queryClient.setQueryData<TData>(queryKey, next)
  }
  return queryClient.getQueryData<TData>(queryKey)
}
