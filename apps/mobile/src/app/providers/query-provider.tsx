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
import { SessionScopeBoundary } from '@cosimosi/auth/react'
import { resetUserState } from '@cosimosi/auth/user-state'
import {
  clearOwnedClientCache,
  resolveClientCacheQueryClient,
  resolveClientCacheTransport,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache'
import { useObservabilityFacade } from '@cosimosi/observability/react'
import { SESSION_SCOPED_TOAST_OWNERS, useToastQueue } from '@cosimosi/ui'

import { resolveMobileApiBaseUrl } from '../../shared/config/index.ts'
import { resetMobileLocaleUserState } from '../../shared/native/locale-storage.ts'
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
  const { dropByOwner } = useToastQueue()
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
      // Session-scoped toasts die with the session that queued them. The queue lives ABOVE auth (an
      // auth error has to be able to toast), so unmounting a feature's host is not enough on its own:
      // an entry waiting behind a long-dwelling error would surface for whoever signs in next. Here
      // it runs from SessionScopeBoundary's change callback, which fires once per real change and
      // never on mount — so unlike an effect keyed on the signed-in identity, a development
      // double-effect cannot throw away notices the incoming session has just queued.
      for (const owner of SESSION_SCOPED_TOAST_OWNERS) dropByOwner(owner)
      resetUserState(nextScopeKey, {
        name: 'locale',
        reset: resetMobileLocaleUserState,
      })
    },
    [dropByOwner, resolvedQueryClient],
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
