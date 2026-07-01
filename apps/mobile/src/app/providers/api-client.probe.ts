import { createPlatformClient, createPlatformMockTransport } from '@cosimosi/api-client';
import { createClientCacheTestContext } from '@cosimosi/client-cache';

export async function probeSharedPlatformClientImport() {
  const client = createPlatformClient(
    createPlatformMockTransport(() => ({
      message: 'pong',
      requestId: 'mobile-import-probe',
    })),
  );

  return client.ping({});
}

export async function probeSharedClientCacheFacade() {
  const context = createClientCacheTestContext({
    ping: () => ({
      message: 'pong',
      requestId: 'mobile-cache-probe',
    }),
  });

  return context.queryClient.fetchQuery(context.platform.pingQueryOptions());
}
