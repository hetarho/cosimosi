import type { DescMessage, DescMethodUnary, DescService, MessageShape } from '@bufbuild/protobuf'
import {
  Code,
  ConnectError,
  createContextValues,
  type UnaryRequest,
  type UnaryResponse,
} from '@connectrpc/connect'
import { describe, expect, it } from 'vitest'

import { createTelemetryRequestIdInterceptor } from './connect.ts'
import { createObservabilityFacade } from './facade.ts'

describe('request id interceptor', () => {
  it('records request ids from successful RPC responses', async () => {
    const observability = createObservabilityFacade()
    const interceptor = createTelemetryRequestIdInterceptor(observability)
    const res = await interceptor(
      async () =>
        ({
          message: {} as MessageShape<DescMessage>,
          stream: false,
          service: fakeService,
          method: fakeMethod,
          header: new Headers({ 'x-request-id': 'request-success' }),
          trailer: new Headers(),
        }) satisfies UnaryResponse,
    )(fakeRequest())

    expect(res.header.get('x-request-id')).toBe('request-success')
    expect(observability.snapshot.requestId).toBe('request-success')
  })

  it('records request ids from Connect errors', async () => {
    const observability = createObservabilityFacade()
    const interceptor = createTelemetryRequestIdInterceptor(observability)
    const metadata = new Headers({ 'x-request-id': 'request-error' })

    await expect(
      interceptor(async () => {
        throw new ConnectError('internal server error', Code.Internal, metadata)
      })(fakeRequest()),
    ).rejects.toThrow('internal server error')

    expect(observability.snapshot.requestId).toBe('request-error')
  })

  it('ignores unsafe request ids from response metadata', async () => {
    const observability = createObservabilityFacade()
    const interceptor = createTelemetryRequestIdInterceptor(observability)

    await interceptor(
      async () =>
        ({
          message: {} as MessageShape<DescMessage>,
          stream: false,
          service: fakeService,
          method: fakeMethod,
          header: new Headers({ 'x-request-id': 'authorization=secret' }),
          trailer: new Headers(),
        }) satisfies UnaryResponse,
    )(fakeRequest())

    expect(observability.snapshot.requestId).toBeNull()
  })
})

const fakeService = {
  typeName: 'cosimosi.TestService',
} as DescService

const fakeMethod = {
  name: 'Ping',
  parent: fakeService,
  idempotency: 0,
} as DescMethodUnary

function fakeRequest(): UnaryRequest {
  return {
    message: {} as MessageShape<DescMessage>,
    stream: false,
    service: fakeService,
    method: fakeMethod,
    header: new Headers(),
    contextValues: createContextValues(),
    signal: new AbortController().signal,
    url: 'https://api.example.test/cosimosi.TestService/Ping',
    requestMethod: 'POST',
  }
}
