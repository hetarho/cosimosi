import { describe, expect, it } from 'vitest'

import {
  PlatformService,
  createApiAuthInterceptor,
  createPlatformClient,
  createPlatformMockTransport,
  createPlatformPingQueryKey,
  createPlatformPingQueryOptions,
  createPlatformServiceQueryKey,
} from './platform.ts'
import { createRouterTransport } from '@connectrpc/connect'

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
    expect(options.queryKey).toEqual(createPlatformPingQueryKey(transport))
    expect(createPlatformServiceQueryKey()[1].serviceName).toContain('PlatformService')
  })

  it('omits serverTime from fake ping responses when the fake does not provide one', async () => {
    const transport = createPlatformMockTransport(() => ({ message: 'pong' }))
    const client = createPlatformClient(transport)

    const response = await client.ping({})

    expect(response.serverTime).toBeUndefined()
  })

  it('attaches bearer tokens through the shared auth interceptor', async () => {
    const seenHeaders: string[] = []
    let token = 'token-1'
    const transport = createRouterTransport(
      ({ service }) => {
        service(PlatformService, {
          ping(_request, context) {
            seenHeaders.push(context.requestHeader.get('Authorization') ?? '')
            return { message: 'pong' }
          },
        })
      },
      {
        transport: {
          interceptors: [
            createApiAuthInterceptor({
              getAccessToken: async () => token,
            }),
          ],
        },
      },
    )
    const client = createPlatformClient(transport)

    await client.ping({})
    token = 'token-2'
    await client.ping({})

    expect(seenHeaders).toEqual(['Bearer token-1', 'Bearer token-2'])
  })

  it('continues anonymously when token access fails', async () => {
    const seenHeaders: string[] = []
    const transport = createRouterTransport(
      ({ service }) => {
        service(PlatformService, {
          ping(_request, context) {
            seenHeaders.push(context.requestHeader.get('Authorization') ?? '')
            return { message: 'pong' }
          },
        })
      },
      {
        transport: {
          interceptors: [
            createApiAuthInterceptor({
              getAccessToken: async () => {
                throw new Error('storage unavailable')
              },
            }),
          ],
        },
      },
    )
    const client = createPlatformClient(transport)

    await client.ping({})

    expect(seenHeaders).toEqual([''])
  })
})
