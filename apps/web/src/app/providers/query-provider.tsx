import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClientProvider } from '@tanstack/react-query'

import { type ApiTransport } from '@cosimosi/api-client'
import { SessionScopeBoundary, useAuthFacade } from '@cosimosi/auth/react'
import { resetUserState } from '@cosimosi/auth/user-state'
import {
  clearOwnedClientCache,
  resolveClientCacheQueryClient,
  resolveClientCacheTransport,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache'
import { useObservabilityFacade } from '@cosimosi/observability/react'
import { SESSION_SCOPED_TOAST_OWNERS, useToastQueue } from '@cosimosi/ui'

import { resetWebLocaleUserState } from '../../shared/lib/locale-storage.ts'
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
  const { dropByOwner } = useToastQueue()
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
      // Session-scoped toasts die with the session that queued them. The queue lives ABOVE auth (an
      // auth error has to be able to toast), so unmounting a feature's host is not enough on its own:
      // an entry waiting behind a long-dwelling error would surface for whoever signs in next. Here
      // it runs from SessionScopeBoundary's change callback, which fires once per real change and
      // never on mount — so unlike an effect keyed on the signed-in identity, a development
      // double-effect cannot throw away notices the incoming session has just queued.
      for (const owner of SESSION_SCOPED_TOAST_OWNERS) dropByOwner(owner)
      resetUserState(nextScopeKey, {
        name: 'locale',
        reset: resetWebLocaleUserState,
      })
    },
    [dropByOwner, resolvedQueryClient],
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
