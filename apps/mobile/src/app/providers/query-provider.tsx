import {createContext, useContext, useEffect, useMemo, useRef, type ReactNode} from 'react';

import {TransportProvider} from '@connectrpc/connect-query';
import {QueryClientProvider} from '@tanstack/react-query';

import {createApiTransport, type ApiTransport} from '@cosimosi/api-client';
import {
  createClientCacheQueryClient,
  createClientCacheRpcPolicyInterceptor,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache';
import {createTelemetryRequestIdInterceptor} from '@cosimosi/observability';
import {useObservabilityFacade} from '@cosimosi/observability/react';

import {resolveMobileApiBaseUrl} from '../../shared/config/index.ts';
import {useAuthFacade, useSessionSnapshot} from './auth-provider.tsx';

interface MobileApiContextValue {
  transport: ApiTransport;
  /** The base URL the live transport was built with — surfaced to diagnostics. */
  baseUrl: string;
}

const MobileApiContext = createContext<MobileApiContextValue | null>(null);

interface MobileClientCacheProviderProps {
  children?: ReactNode;
  apiBaseUrl?: string;
  queryClient?: ClientCacheQueryClient;
  transport?: ApiTransport;
}

export function MobileClientCacheProvider({children, apiBaseUrl, queryClient, transport}: MobileClientCacheProviderProps) {
  const auth = useAuthFacade();
  const observability = useObservabilityFacade();
  const session = useSessionSnapshot();
  const baseUrl = apiBaseUrl ?? resolveMobileApiBaseUrl();
  const cacheScope = session.userId ?? 'anonymous';
  const ownedQueryClient = useRef<ClientCacheQueryClient | null>(null);
  if (!queryClient && !ownedQueryClient.current) {
    ownedQueryClient.current = createClientCacheQueryClient();
  }
  const resolvedQueryClient = queryClient ?? ownedQueryClient.current ?? createClientCacheQueryClient();
  const resolvedTransport = useMemo(
    () =>
      transport ??
      createApiTransport({
        baseUrl,
        auth,
        interceptors: [createClientCacheRpcPolicyInterceptor(), createTelemetryRequestIdInterceptor(observability)],
      }),
    [auth, baseUrl, observability, transport],
  );
  const previousCacheScope = useRef(cacheScope);
  const apiContextValue = useMemo<MobileApiContextValue>(
    () => ({transport: resolvedTransport, baseUrl}),
    [baseUrl, resolvedTransport],
  );

  useEffect(
    () => () => {
      if (!queryClient) ownedQueryClient.current?.clear();
    },
    [queryClient],
  );
  useEffect(() => {
    if (previousCacheScope.current === cacheScope) return;
    if (!queryClient) resolvedQueryClient.clear();
    previousCacheScope.current = cacheScope;
  }, [cacheScope, queryClient, resolvedQueryClient]);

  return (
    <TransportProvider transport={resolvedTransport}>
      <MobileApiContext.Provider value={apiContextValue}>
        <QueryClientProvider client={resolvedQueryClient}>{children}</QueryClientProvider>
      </MobileApiContext.Provider>
    </TransportProvider>
  );
}

function useMobileApiContext(): MobileApiContextValue {
  const value = useContext(MobileApiContext);
  if (!value) throw new Error('useMobileApi* must be used inside MobileClientCacheProvider');
  return value;
}

export function useMobileApiTransport(): ApiTransport {
  return useMobileApiContext().transport;
}

/** The base URL the live transport uses (honours an injected apiBaseUrl override). */
export function useMobileApiBaseUrl(): string {
  return useMobileApiContext().baseUrl;
}
