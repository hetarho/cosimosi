import { useEffect, useMemo, useRef, type ReactNode } from 'react'

import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClientProvider } from '@tanstack/react-query'

import { createApiTransport, type ApiTransport } from '@cosimosi/api-client'
import {
  createClientCacheQueryClient,
  createClientCacheRpcPolicyInterceptor,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache'
import { createTelemetryRequestIdInterceptor } from '@cosimosi/observability'
import { useObservabilityFacade } from '@cosimosi/observability/react'

import { useAuthFacade, useSessionSnapshot } from './auth-context.ts'
import { resolveWebApiBaseUrl } from './query-config.ts'

interface WebClientCacheProviderProps {
  children?: ReactNode
  apiBaseUrl?: string
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
}

export function WebClientCacheProvider({ children, apiBaseUrl, queryClient, transport }: WebClientCacheProviderProps) {
  const auth = useAuthFacade()
  const observability = useObservabilityFacade()
  const session = useSessionSnapshot()
  const baseUrl = apiBaseUrl ?? resolveWebApiBaseUrl(import.meta.env)
  const cacheScope = session.userId ?? 'anonymous'
  const ownedQueryClient = useRef<ClientCacheQueryClient | null>(null)
  if (!queryClient && !ownedQueryClient.current) {
    ownedQueryClient.current = createClientCacheQueryClient()
  }
  const resolvedQueryClient = queryClient ?? ownedQueryClient.current ?? createClientCacheQueryClient()
  const resolvedTransport = useMemo(
    () =>
      transport ??
      createApiTransport({
        baseUrl,
        auth,
        interceptors: [createClientCacheRpcPolicyInterceptor(), createTelemetryRequestIdInterceptor(observability)],
      }),
    [auth, baseUrl, observability, transport],
  )
  const previousCacheScope = useRef(cacheScope)

  useEffect(
    () => () => {
      if (!queryClient) ownedQueryClient.current?.clear()
    },
    [queryClient],
  )
  useEffect(() => {
    if (previousCacheScope.current === cacheScope) return
    if (!queryClient) resolvedQueryClient.clear()
    previousCacheScope.current = cacheScope
  }, [cacheScope, queryClient, resolvedQueryClient])

  return (
    <TransportProvider transport={resolvedTransport}>
      <QueryClientProvider client={resolvedQueryClient}>{children}</QueryClientProvider>
    </TransportProvider>
  )
}
