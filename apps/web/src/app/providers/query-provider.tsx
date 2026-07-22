import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

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
import { SessionScopeBoundary } from '@cosimosi/auth/react'

import { resetWebUserState } from '../model/reset-user-state.ts'
import { useAuthFacade } from '../../shared/auth/index.ts'
import { resolveWebApiBaseUrl } from './query-config.ts'

interface WebClientCacheProviderProps {
  children?: ReactNode
  apiBaseUrl?: string
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
}

export function WebClientCacheProvider({
  children,
  apiBaseUrl,
  queryClient,
  transport,
}: WebClientCacheProviderProps) {
  const auth = useAuthFacade()
  const observability = useObservabilityFacade()
  const baseUrl = apiBaseUrl ?? resolveWebApiBaseUrl(import.meta.env)
  const ownedQueryClient = useRef<ClientCacheQueryClient | null>(null)
  const ownsQueryClient = !queryClient
  const resolvedQueryClient = resolveClientCacheQueryClient({ queryClient, ownedQueryClient })
  const resolvedTransport = useMemo(
    () => resolveClientCacheTransport({ transport, baseUrl, auth, observability }),
    [auth, baseUrl, observability, transport],
  )
  const resetScope = useCallback(
    (nextScopeKey: string) => {
      resolvedQueryClient.clear()
      resetWebUserState(nextScopeKey)
    },
    [resolvedQueryClient],
  )

  useEffect(
    () => () => {
      clearOwnedClientCache(resolvedQueryClient, ownsQueryClient)
    },
    [ownsQueryClient, resolvedQueryClient],
  )
  return (
    <TransportProvider transport={resolvedTransport}>
      <QueryClientProvider client={resolvedQueryClient}>
        <SessionScopeBoundary onScopeChange={resetScope}>{children}</SessionScopeBoundary>
      </QueryClientProvider>
    </TransportProvider>
  )
}
