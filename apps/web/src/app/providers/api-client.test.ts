import { describe, expect, it } from 'vitest'

import { createPlatformClient, createPlatformMockTransport } from '@cosimosi/api-client'

describe('web api-client import probe', () => {
  it('imports the shared PlatformService client facade', async () => {
    const client = createPlatformClient(
      createPlatformMockTransport(() => ({
        message: 'pong',
        requestId: 'web-import-probe',
      })),
    )

    const response = await client.ping({})

    expect(response.requestId).toBe('web-import-probe')
  })
})
