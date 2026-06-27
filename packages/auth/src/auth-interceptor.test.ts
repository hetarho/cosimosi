import { createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it } from 'vitest'

import { createPlatformClient, PlatformService } from '@cosimosi/api-client'

import type { AuthFacade } from './auth-adapter.ts'
import { createAuthInterceptor } from './auth-interceptor.ts'
import { initialSessionSnapshot } from './session.ts'

describe('createAuthInterceptor', () => {
  it('attaches the bearer token at RPC call time', async () => {
    const seenHeaders: string[] = []
    let token = 'token-1'
    const facade: AuthFacade = {
      snapshot: initialSessionSnapshot,
      signIn: async () => {},
      signOut: async () => {},
      refresh: async () => {},
      getAccessToken: async () => token,
      subscribe: () => () => {},
      dispose: () => {},
    }
    const transport = createRouterTransport(
      ({ service }) => {
        service(PlatformService, {
          ping(_request, context) {
            seenHeaders.push(context.requestHeader.get('Authorization') ?? '')
            return {
              message: 'pong',
              requestId: 'auth-interceptor-test',
            }
          },
        })
      },
      {
        transport: {
          interceptors: [createAuthInterceptor(facade)],
        },
      },
    )
    const client = createPlatformClient(transport)

    await client.ping({})
    token = 'token-2'
    await client.ping({})

    expect(seenHeaders).toEqual(['Bearer token-1', 'Bearer token-2'])
  })
})
