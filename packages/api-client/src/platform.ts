import { timestampFromDate } from '@bufbuild/protobuf/wkt'
import { createClient, createRouterTransport, type Client, type Interceptor, type Transport } from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'
import { createConnectTransport } from '@connectrpc/connect-web'

import { PlatformService } from './gen/cosimosi/platform/v1/platform_pb.ts'

export { PlatformService } from './gen/cosimosi/platform/v1/platform_pb.ts'
export type { PingRequest, PingResponse } from './gen/cosimosi/platform/v1/platform_pb.ts'
export type { Transport as ApiTransport } from '@connectrpc/connect'
export { timestampDate } from '@bufbuild/protobuf/wkt'

export interface ApiAuthTokenProvider {
  getAccessToken(): Promise<string | null>
}

export interface ApiTransportOptions {
  baseUrl: string
  useHttpGet?: boolean
  auth?: ApiAuthTokenProvider
  interceptors?: Interceptor[]
}

export function createApiTransport({ baseUrl, useHttpGet = true, auth, interceptors = [] }: ApiTransportOptions): Transport {
  return createConnectTransport({
    baseUrl,
    useHttpGet,
    interceptors: auth ? [createApiAuthInterceptor(auth), ...interceptors] : interceptors,
  })
}

export function createApiAuthInterceptor(auth: ApiAuthTokenProvider): Interceptor {
  return (next) => async (req) => {
    let token: string | null = null
    try {
      token = await auth.getAccessToken()
    } catch {
      token = null
    }
    if (token) {
      req.header.set('Authorization', `Bearer ${token}`)
    }
    return next(req)
  }
}

export function createPlatformClient(transport: Transport): Client<typeof PlatformService> {
  return createClient(PlatformService, transport)
}

export function createPlatformMockTransport(
  ping: () => { message: string; requestId?: string; serverTime?: Date },
): Transport {
  return createRouterTransport(({ service }) => {
    service(PlatformService, {
      ping() {
        const response = ping()
        const serverTime = response.serverTime ? timestampFromDate(response.serverTime) : undefined
        return {
          message: response.message,
          requestId: response.requestId ?? 'test-request-id',
          serverTime,
        }
      },
    })
  })
}

export function createPlatformServiceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: PlatformService,
    transport,
    cardinality: undefined,
  })
}

export function createPlatformPingQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: PlatformService.method.ping,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createPlatformPingQueryOptions(transport: Transport) {
  return createQueryOptions(PlatformService.method.ping, undefined, { transport })
}
