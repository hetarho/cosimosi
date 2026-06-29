import { describe, expect, it, vi } from 'vitest'

import { createContextValues, type Interceptor, type UnaryRequest, type UnaryResponse } from '@connectrpc/connect'

import { PlatformService, createPlatformPingQueryOptions } from '@cosimosi/api-client'

import { clientCacheTimings, createClientCacheQueryClient } from './defaults.ts'
import {
  createClientCacheRpcPolicyInterceptor,
  createRpcCachePolicyInterceptor,
  defineRpcCachePolicy,
  idempotentUnaryReadPolicy,
  rpcMethodPolicyKey,
  unaryWritePolicy,
  type RpcMethodDescriptor,
} from './http-policy.ts'
import { isConnectQueryKey, platformCacheKeys } from './keys.ts'
import { beginOptimisticMutation } from './optimistic.ts'
import { assertClientCacheData } from './render-state.ts'
import { createClientCacheTestContext, setClientCacheData } from './test-helpers.ts'

describe('client cache facade', () => {
  it('creates isolated QueryClient instances with generated default timing values', () => {
    const first = createClientCacheQueryClient()
    const second = createClientCacheQueryClient()

    expect(first).not.toBe(second)
    expect(first.getDefaultOptions().queries?.staleTime).toBe(clientCacheTimings.defaultStaleMs)
    expect(first.getDefaultOptions().queries?.gcTime).toBe(clientCacheTimings.defaultGcMs)
    expect(first.getDefaultOptions().queries?.retry).toBe(clientCacheTimings.defaultRetryCount)
  })

  it('fetches generated connect-query options through a fake transport', async () => {
    const context = createClientCacheTestContext({
      ping: () => ({
        message: 'pong from fake transport',
        requestId: 'cache-test-request',
        serverTime: new Date(0),
      }),
    })

    const response = await context.queryClient.fetchQuery(context.platform.pingQueryOptions())

    expect(response.message).toBe('pong from fake transport')
    expect(response.requestId).toBe('cache-test-request')
    expect(context.inspectCache()).toHaveLength(1)
  })

  it('exports connect-query cache keys instead of ad-hoc string keys', () => {
    const key = platformCacheKeys.ping()

    expect(isConnectQueryKey(key)).toBe(true)
    expect(key[0]).toBe('connect-query')
    expect(key[1].methodName).toBe('Ping')
  })

  it('keeps query option keys aligned with the API-client facade', () => {
    const context = createClientCacheTestContext()
    const helperKey = platformCacheKeys.ping(context.transport)
    const optionsKey = createPlatformPingQueryOptions(context.transport).queryKey

    expect(optionsKey).toEqual(helperKey)
  })

  it('supports optimistic snapshot, rollback, and settle invalidation', async () => {
    const context = createClientCacheTestContext()
    const key = platformCacheKeys.ping(context.transport)
    const invalidateKey = platformCacheKeys.service(context.transport)
    setClientCacheData(context.queryClient, key, { message: 'before' })
    setClientCacheData(context.queryClient, invalidateKey, { touched: false })

    const optimistic = await beginOptimisticMutation({
      queryClient: context.queryClient,
      patches: [
        {
          queryKey: key,
          update: () => ({ message: 'optimistic' }),
        },
      ],
      invalidate: [invalidateKey],
    })

    expect(context.queryClient.getQueryData<{ message: string }>(key)?.message).toBe('optimistic')
    expect(optimistic.snapshots).toMatchObject([{ queryKey: key, exists: true, data: { message: 'before' } }])
    expect(optimistic.rollbackDelayMs).toBe(clientCacheTimings.optimisticRollbackMs)

    optimistic.rollback()
    expect(context.queryClient.getQueryData<{ message: string }>(key)?.message).toBe('before')

    await optimistic.settle()
    expect(context.queryClient.getQueryCache().find({ queryKey: invalidateKey })?.state.isInvalidated).toBe(true)
  })

  it('treats undefined cache updates as explicit query removal', () => {
    const context = createClientCacheTestContext()
    const key = platformCacheKeys.ping(context.transport)
    setClientCacheData(context.queryClient, key, { message: 'before' })

    const result = setClientCacheData(context.queryClient, key, () => undefined)

    expect(result).toBeUndefined()
    expect(context.queryClient.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined()
  })

  it('restores cloned optimistic snapshots after in-place patch mutation', async () => {
    const context = createClientCacheTestContext()
    const key = platformCacheKeys.ping(context.transport)
    setClientCacheData(context.queryClient, key, { items: [{ message: 'before' }] })

    const optimistic = await beginOptimisticMutation({
      queryClient: context.queryClient,
      patches: [
        {
          queryKey: key,
          update: (current: { items: { message: string }[] } | undefined) => {
            if (current) current.items[0].message = 'optimistic'
            return current
          },
        },
      ],
    })

    expect(context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message).toBe('optimistic')
    optimistic.rollback()
    expect(context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message).toBe('before')

    const restored = context.queryClient.getQueryData<{ items: { message: string }[] }>(key)
    if (restored) restored.items[0].message = 'mutated-after-rollback'
    optimistic.rollback()
    expect(context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message).toBe('before')
  })

  it('clones typed array views in fallback optimistic snapshots', async () => {
    vi.stubGlobal('structuredClone', undefined)
    try {
      const context = createClientCacheTestContext()
      const key = platformCacheKeys.ping(context.transport)
      context.queryClient.setQueryData(key, { matrix: new Int32Array([1, 2, 3]) })

      const optimistic = await beginOptimisticMutation({
        queryClient: context.queryClient,
        patches: [
          {
            queryKey: key,
            update: () => ({ message: 'optimistic' }),
          },
        ],
      })

      optimistic.rollback()
      const restored = context.queryClient.getQueryData<{ matrix: Int32Array }>(key)
      if (restored) restored.matrix[0] = 9
      optimistic.rollback()
      expect(context.queryClient.getQueryData<{ matrix: Int32Array }>(key)?.matrix[0]).toBe(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rolls back optimistic removal patches by recreating the removed query', async () => {
    const context = createClientCacheTestContext()
    const key = platformCacheKeys.ping(context.transport)
    setClientCacheData(context.queryClient, key, { message: 'before' })

    const optimistic = await beginOptimisticMutation({
      queryClient: context.queryClient,
      patches: [
        {
          queryKey: key,
          update: () => undefined,
        },
      ],
    })

    expect(context.queryClient.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined()
    optimistic.rollback()
    expect(context.queryClient.getQueryData<{ message: string }>(key)?.message).toBe('before')
  })

  it('rolls back already-applied optimistic patches when a later patch fails', async () => {
    const context = createClientCacheTestContext()
    const firstKey = platformCacheKeys.ping(context.transport)
    const secondKey = platformCacheKeys.service(context.transport)
    setClientCacheData(context.queryClient, firstKey, { message: 'first-before' })
    setClientCacheData(context.queryClient, secondKey, { message: 'second-before' })

    await expect(
      beginOptimisticMutation({
        queryClient: context.queryClient,
        patches: [
          {
            queryKey: firstKey,
            update: () => ({ message: 'first-optimistic' }),
          },
          {
            queryKey: secondKey,
            update: () => ({ coordinates: new Float32Array([0, 1, 2]) }),
          },
        ],
      }),
    ).rejects.toThrow(/render-loop buffer/)

    expect(context.queryClient.getQueryData<{ message: string }>(firstKey)?.message).toBe('first-before')
    expect(context.queryClient.getQueryData<{ message: string }>(secondKey)?.message).toBe('second-before')
  })

  it('rejects render-loop buffers while allowing plain scalar fields', () => {
    expect(() => assertClientCacheData(new Float32Array([0, 1, 2]))).toThrow(/render-loop buffer/)
    expect(() => assertClientCacheData({ payload: new Uint8Array([1, 2, 3]) })).not.toThrow()
    expect(() =>
      setClientCacheData(createClientCacheQueryClient(), platformCacheKeys.ping(), {
        coordinates: new Float32Array([0, 1, 2]),
      }),
    ).toThrow(/render-loop buffer/)
    expect(() =>
      setClientCacheData(createClientCacheQueryClient(), platformCacheKeys.ping(), {
        scalarScore: 0.8,
      }),
    ).not.toThrow()
    expect(() => assertClientCacheData(new Map([['visual', new Float32Array([0, 1, 2])]]))).toThrow(/render-loop buffer/)
    expect(() => assertClientCacheData(new Set([new Float32Array([0, 1, 2])]))).toThrow(/render-loop buffer/)
  })

  it('rejects circular cache data with a bounded error', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    expect(() => assertClientCacheData(circular)).toThrow(/circular cache data/)
  })

  it('allows GET only for idempotent reads and rejects shared CDN for user-scoped data', async () => {
    expect(idempotentUnaryReadPolicy.method).toBe('GET')
    expect(unaryWritePolicy.method).toBe('POST')
    expect(() =>
      defineRpcCachePolicy({
        idempotent: false,
        method: 'GET',
        sharedCdn: false,
        userScoped: false,
      }),
    ).toThrow(/idempotent/)
    expect(() =>
      defineRpcCachePolicy({
        idempotent: true,
        method: 'GET',
        sharedCdn: true,
        userScoped: true,
      }),
    ).toThrow(/User-scoped/)
    expect(rpcMethodPolicyKey(PlatformService.method.ping)).toBe('cosimosi.platform.v1.PlatformService/Ping')
    await expect(callPolicyInterceptor(createClientCacheRpcPolicyInterceptor(), 'POST')).resolves.toBe(true)
    await expect(callPolicyInterceptor(createRpcCachePolicyInterceptor([]), 'GET')).rejects.toThrow(/without an explicit/)
    await expect(callPolicyInterceptor(createRpcCachePolicyInterceptor([]), 'POST')).rejects.toThrow(/without an explicit/)
    await expect(
      callPolicyInterceptor(
        createRpcCachePolicyInterceptor([{ method: PlatformService.method.ping, policy: unaryWritePolicy }]),
        'POST',
      ),
    ).rejects.toThrow(/registered with a POST/)
    await expect(
      callPolicyInterceptor(
        createRpcCachePolicyInterceptor([{ method: nonIdempotentMethod, policy: idempotentUnaryReadPolicy }]),
        'POST',
        nonIdempotentMethod,
      ),
    ).rejects.toThrow(/NO_SIDE_EFFECTS/)
  })
})

async function callPolicyInterceptor(
  interceptor: Interceptor,
  requestMethod: string,
  method: RpcMethodDescriptor = PlatformService.method.ping,
): Promise<boolean> {
  let called = false
  await interceptor(async (req) => {
    called = true
    return {
      stream: false,
      service: req.service,
      method: req.method,
      header: req.header,
      trailer: req.header,
      message: {},
    } as unknown as UnaryResponse
  })(createUnaryRequest(method, requestMethod))
  return called
}

const nonIdempotentMethod: RpcMethodDescriptor = {
  name: 'Write',
  idempotency: 0,
  parent: {
    typeName: 'cosimosi.test.v1.TestService',
  },
}

function createUnaryRequest(method: RpcMethodDescriptor, requestMethod: string): UnaryRequest {
  return {
    stream: false,
    service: method.parent,
    method,
    requestMethod,
    url: `https://api.example.test/${rpcMethodPolicyKey(method)}`,
    signal: {} as UnaryRequest['signal'],
    header: {} as UnaryRequest['header'],
    contextValues: createContextValues(),
    message: {},
  } as unknown as UnaryRequest
}
