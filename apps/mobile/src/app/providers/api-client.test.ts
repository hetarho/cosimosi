import { describe, expect, it } from '@jest/globals'

import { createPlatformClient, createPlatformMockTransport } from '@cosimosi/api-client'
import { createClientCacheTestContext } from '@cosimosi/client-cache'

// Proves the shared transport and cache facades actually resolve and run under Metro's module
// resolution — the failure this cannot be caught web-side, because the web app resolves them through
// Vite. It asserts a round trip rather than a bare import: a facade can resolve and still be wired
// to nothing.
describe('mobile api-client import probe', () => {
  it('imports the shared PlatformService client facade', async () => {
    const client = createPlatformClient(
      createPlatformMockTransport(() => ({
        message: 'pong',
        requestId: 'mobile-import-probe',
      })),
    )

    const response = await client.ping({})

    expect(response.requestId).toBe('mobile-import-probe')
  })

  it('imports the shared client-cache facade and resolves a query through it', async () => {
    const context = createClientCacheTestContext({
      ping: () => ({
        message: 'pong',
        requestId: 'mobile-cache-probe',
      }),
    })

    const response = await context.queryClient.fetchQuery(context.platform.pingQueryOptions())

    expect(response.requestId).toBe('mobile-cache-probe')
  })
})
