import { useEffect, useMemo, useRef, type ReactNode } from 'react'

import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClientProvider } from '@tanstack/react-query'

import { type ApiTransport } from '@cosimosi/api-client'
import {
  clearOwnedClientCache,
  resolveClientCacheQueryClient,
  resolveClientCacheTransport,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache'
import { useObservabilityFacade } from '@cosimosi/observability/react'

import { useAuthFacade, useSessionSnapshot } from '../../shared/auth/index.ts'
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
  const ownsQueryClient = !queryClient
  const resolvedQueryClient = resolveClientCacheQueryClient({ queryClient, ownedQueryClient })
  const resolvedTransport = useMemo(
    () => resolveClientCacheTransport({ transport, baseUrl, auth, observability }),
    [auth, baseUrl, observability, transport],
  )
  const previousCacheScope = useRef(cacheScope)

  useEffect(
    () => () => {
      clearOwnedClientCache(resolvedQueryClient, ownsQueryClient)
    },
    [ownsQueryClient, resolvedQueryClient],
  )
  useEffect(() => {
    if (previousCacheScope.current === cacheScope) return
    clearOwnedClientCache(resolvedQueryClient, ownsQueryClient)
    previousCacheScope.current = cacheScope
  }, [cacheScope, ownsQueryClient, resolvedQueryClient])

  return (
    <TransportProvider transport={resolvedTransport}>
      <QueryClientProvider client={resolvedQueryClient}>{children}</QueryClientProvider>
    </TransportProvider>
  )
}
