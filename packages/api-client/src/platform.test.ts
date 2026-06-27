import { describe, expect, it } from 'vitest'

import { createPlatformClient, createPlatformMockTransport, createPlatformPingQueryOptions } from './platform.ts'

describe('platform transport facade', () => {
  it('calls PlatformService.Ping through an in-memory transport', async () => {
    const transport = createPlatformMockTransport(() => ({
      message: 'pong',
      requestId: 'request-test-client',
      serverTime: new Date(0),
    }))
    const client = createPlatformClient(transport)

    const response = await client.ping({})

    expect(response.message).toBe('pong')
    expect(response.requestId).toBe('request-test-client')
  })

  it('creates TanStack Query options for Ping without React or app globals', () => {
    const transport = createPlatformMockTransport(() => ({ message: 'pong' }))
    const options = createPlatformPingQueryOptions(transport)

    expect(options.queryKey[0]).toBe('connect-query')
    expect(typeof options.queryFn).toBe('function')
  })
})
