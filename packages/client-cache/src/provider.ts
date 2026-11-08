import type { ApiTransport } from '@cosimosi/api-client'
import {
  createApiTransport,
  createGetProfileQueryKey,
  createTwinkleServiceQueryKey,
  createSyncStatusQueryOptions,
} from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import {
  createTelemetryRequestIdInterceptor,
  type ObservabilityFacade,
} from '@cosimosi/observability'
import type { QueryClient as ClientCacheQueryClient } from '@tanstack/query-core'

import { createClientCacheQueryClient } from './defaults.ts'
import { createClientCacheRpcPolicyInterceptor } from './http-policy.ts'

export interface ResolveClientCacheQueryClientOptions {
  queryClient?: ClientCacheQueryClient
  ownedQueryClient: { current: ClientCacheQueryClient | null }
}

export function resolveClientCacheQueryClient({
  queryClient,
  ownedQueryClient,
}: ResolveClientCacheQueryClientOptions): ClientCacheQueryClient {
  if (queryClient) return queryClient
  if (!ownedQueryClient.current) ownedQueryClient.current = createClientCacheQueryClient()
  return ownedQueryClient.current
}

export interface ResolveClientCacheTransportOptions {
  transport?: ApiTransport
  baseUrl: string
  auth: AuthFacade
  observability: ObservabilityFacade
}

export function resolveClientCacheTransport({
  transport,
  baseUrl,
  auth,
  observability,
}: ResolveClientCacheTransportOptions): ApiTransport {
  return (
    transport ??
    createApiTransport({
      baseUrl,
      auth,
      interceptors: [
        createClientCacheRpcPolicyInterceptor(),
        createTelemetryRequestIdInterceptor(observability),
      ],
    })
  )
}

export function clearOwnedClientCache(
  queryClient: ClientCacheQueryClient,
  ownsQueryClient: boolean,
): void {
  if (ownsQueryClient) queryClient.clear()
}

export async function invalidateProfileDependentQueries(
  queryClient: ClientCacheQueryClient,
  transport: ApiTransport,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: createGetProfileQueryKey(transport) }),
    queryClient.invalidateQueries({ queryKey: createTwinkleServiceQueryKey(transport) }),
    queryClient.invalidateQueries({ queryKey: createSyncStatusQueryOptions(transport).queryKey }),
  ])
}
