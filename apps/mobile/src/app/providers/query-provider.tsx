import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

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

import { resetMobileUserState } from '../model/reset-user-state.ts'
import { resolveMobileApiBaseUrl } from '../../shared/config/index.ts'
import { useAuthFacade } from './auth-provider.tsx'

interface MobileApiContextValue {
  transport: ApiTransport
  /** The base URL the live transport was built with — surfaced to diagnostics. */
  baseUrl: string
}

const MobileApiContext = createContext<MobileApiContextValue | null>(null)

interface MobileClientCacheProviderProps {
  children?: ReactNode
  apiBaseUrl?: string
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
}

export function MobileClientCacheProvider({
  children,
  apiBaseUrl,
  queryClient,
  transport,
}: MobileClientCacheProviderProps) {
  const auth = useAuthFacade()
  const observability = useObservabilityFacade()
  const baseUrl = apiBaseUrl ?? resolveMobileApiBaseUrl()
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
      resetMobileUserState(nextScopeKey)
    },
    [resolvedQueryClient],
  )
  const apiContextValue = useMemo<MobileApiContextValue>(
    () => ({ transport: resolvedTransport, baseUrl }),
    [baseUrl, resolvedTransport],
  )

  useEffect(
    () => () => {
      clearOwnedClientCache(resolvedQueryClient, ownsQueryClient)
    },
    [ownsQueryClient, resolvedQueryClient],
  )
  return (
    <TransportProvider transport={resolvedTransport}>
      <MobileApiContext.Provider value={apiContextValue}>
        <QueryClientProvider client={resolvedQueryClient}>
          <SessionScopeBoundary onScopeChange={resetScope}>{children}</SessionScopeBoundary>
        </QueryClientProvider>
      </MobileApiContext.Provider>
    </TransportProvider>
  )
}

function useMobileApiContext(): MobileApiContextValue {
  const value = useContext(MobileApiContext)
  if (!value) throw new Error('useMobileApi* must be used inside MobileClientCacheProvider')
  return value
}

export function useMobileApiTransport(): ApiTransport {
  return useMobileApiContext().transport
}

/** The base URL the live transport uses (honours an injected apiBaseUrl override). */
export function useMobileApiBaseUrl(): string {
  return useMobileApiContext().baseUrl
}
