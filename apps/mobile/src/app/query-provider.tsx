import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { TransportProvider } from '@connectrpc/connect-query';
import { QueryClientProvider } from '@tanstack/react-query';

import { createApiTransport, type ApiTransport } from '@cosimosi/api-client';
import {
  createClientCacheQueryClient,
  createClientCacheRpcPolicyInterceptor,
  type ClientCacheQueryClient,
} from '@cosimosi/client-cache';
import { createTelemetryRequestIdInterceptor } from '@cosimosi/observability';
import { useObservabilityFacade } from '@cosimosi/observability/react';

import { useAuthFacade, useSessionSnapshot } from './auth-provider';

const ApiTransportContext = createContext<ApiTransport | null>(null);

interface MobileClientCacheProviderProps {
  children?: ReactNode;
  apiBaseUrl?: string;
  queryClient?: ClientCacheQueryClient;
  transport?: ApiTransport;
}

export function resolveMobileApiBaseUrl(platformOS: typeof Platform.OS = Platform.OS): string {
  return platformOS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

export function MobileClientCacheProvider({ children, apiBaseUrl, queryClient, transport }: MobileClientCacheProviderProps) {
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
      <ApiTransportContext.Provider value={resolvedTransport}>
        <QueryClientProvider client={resolvedQueryClient}>{children}</QueryClientProvider>
      </ApiTransportContext.Provider>
    </TransportProvider>
  );
}

export function useMobileApiTransport(): ApiTransport {
  const transport = useContext(ApiTransportContext);
  if (!transport) throw new Error('useMobileApiTransport must be used inside MobileClientCacheProvider');
  return transport;
}
