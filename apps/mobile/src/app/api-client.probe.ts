import { createPlatformClient, createPlatformMockTransport } from '@cosimosi/api-client';

export async function probeSharedPlatformClientImport() {
  const client = createPlatformClient(
    createPlatformMockTransport(() => ({
      message: 'pong',
      requestId: 'mobile-import-probe',
    })),
  );

  return client.ping({});
}
