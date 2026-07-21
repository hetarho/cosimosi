import { describe, expect, it, vi } from 'vitest'

import {
  createContextValues,
  type Interceptor,
  type UnaryRequest,
  type UnaryResponse,
} from '@connectrpc/connect'

import {
  MemoryService,
  PlatformService,
  SpendKind,
  TwinkleService,
  apiServiceDescriptors,
  createMemoryClient,
  createGetUniverseQueryOptions,
  createPlatformPingQueryOptions,
  createTwinkleClient,
} from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import { createObservabilityFacade } from '@cosimosi/observability'

import { clientCacheTimings, createClientCacheQueryClient } from './defaults.ts'
import {
  assertRpcCachePolicyCoverage,
  clientCacheRpcCachePolicies,
  createClientCacheRpcPolicyInterceptor,
  createRpcCachePolicyInterceptor,
  defineRpcCachePolicy,
  idempotentUnaryReadPolicy,
  memoryRpcCachePolicies,
  platformPublicRpcReads,
  rpcMethodPolicyKey,
  unaryWritePolicy,
  userScopedUnaryReadPolicy,
  type RpcMethodDescriptor,
  type RpcCachePolicyEntry,
} from './http-policy.ts'
import { isConnectQueryKey, memoryCacheKeys, platformCacheKeys } from './keys.ts'
import { beginOptimisticMutation } from './optimistic.ts'
import { assertClientCacheData } from './render-state.ts'
import { createClientCacheTestContext, setClientCacheData } from './test-helpers.ts'
import { resolveClientCacheTransport } from './provider.ts'

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
    expect(optimistic.snapshots).toMatchObject([
      { queryKey: key, exists: true, data: { message: 'before' } },
    ])
    expect(optimistic.rollbackDelayMs).toBe(clientCacheTimings.optimisticRollbackMs)

    optimistic.rollback()
    expect(context.queryClient.getQueryData<{ message: string }>(key)?.message).toBe('before')

    await optimistic.settle()
    expect(
      context.queryClient.getQueryCache().find({ queryKey: invalidateKey })?.state.isInvalidated,
    ).toBe(true)
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

    expect(
      context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message,
    ).toBe('optimistic')
    optimistic.rollback()
    expect(
      context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message,
    ).toBe('before')

    const restored = context.queryClient.getQueryData<{ items: { message: string }[] }>(key)
    if (restored) restored.items[0].message = 'mutated-after-rollback'
    optimistic.rollback()
    expect(
      context.queryClient.getQueryData<{ items: { message: string }[] }>(key)?.items[0].message,
    ).toBe('before')
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

    expect(context.queryClient.getQueryData<{ message: string }>(firstKey)?.message).toBe(
      'first-before',
    )
    expect(context.queryClient.getQueryData<{ message: string }>(secondKey)?.message).toBe(
      'second-before',
    )
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
    expect(() => assertClientCacheData(new Map([['visual', new Float32Array([0, 1, 2])]]))).toThrow(
      /render-loop buffer/,
    )
    expect(() => assertClientCacheData(new Set([new Float32Array([0, 1, 2])]))).toThrow(
      /render-loop buffer/,
    )
  })

  it('rejects circular cache data with a bounded error', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    expect(() => assertClientCacheData(circular)).toThrow(/circular cache data/)
  })

  it('registers GetUniverse as a GET-eligible, user-scoped, never-shared-CDN read', async () => {
    const entry = memoryRpcCachePolicies.find(
      (candidate) => candidate.method === MemoryService.method.getUniverse,
    )

    expect(entry).toBeDefined()
    expect(entry?.policy).toBe(userScopedUnaryReadPolicy)
    expect(userScopedUnaryReadPolicy).toMatchObject({
      idempotent: true,
      method: 'GET',
      sharedCdn: false,
      userScoped: true,
    })
    expect(rpcMethodPolicyKey(MemoryService.method.getUniverse)).toBe(
      'cosimosi.memory.v1.MemoryService/GetUniverse',
    )
    // The default client interceptor accepts the registered GET without throwing.
    await expect(
      callPolicyInterceptor(
        createClientCacheRpcPolicyInterceptor(),
        'GET',
        MemoryService.method.getUniverse,
      ),
    ).resolves.toBe(true)
    // Unregistered NO_SIDE_EFFECTS methods still fail loud.
    await expect(
      callPolicyInterceptor(
        createRpcCachePolicyInterceptor([]),
        'GET',
        MemoryService.method.getUniverse,
      ),
    ).rejects.toThrow(/without an explicit/)
  })

  it('classifies every generated NO_SIDE_EFFECTS unary method exactly once', () => {
    const generatedReadKeys = apiServiceDescriptors
      .flatMap((service) => service.methods)
      .filter((method) => method.methodKind === 'unary' && method.idempotency === 1)
      .map(rpcMethodPolicyKey)
      .sort()
    const registeredReadKeys = clientCacheRpcCachePolicies
      .map((entry) => rpcMethodPolicyKey(entry.method))
      .sort()

    expect(registeredReadKeys).toEqual(generatedReadKeys)
    expect(generatedReadKeys).toHaveLength(8)
    expect(() =>
      assertRpcCachePolicyCoverage(
        apiServiceDescriptors,
        clientCacheRpcCachePolicies,
        platformPublicRpcReads,
      ),
    ).not.toThrow()

    const publicKeys = new Set(platformPublicRpcReads.map(rpcMethodPolicyKey))
    for (const entry of clientCacheRpcCachePolicies) {
      expect(entry.policy).toMatchObject({
        idempotent: true,
        method: 'GET',
        sharedCdn: false,
        userScoped: !publicKeys.has(rpcMethodPolicyKey(entry.method)),
      })
    }
  })

  it('rejects incomplete, duplicate, write, and incompatible generated policy registries', () => {
    const assertCoverage = (entries: readonly RpcCachePolicyEntry[]) =>
      assertRpcCachePolicyCoverage(apiServiceDescriptors, entries, platformPublicRpcReads)

    expect(() => assertCoverage(clientCacheRpcCachePolicies.slice(1))).toThrow(/no explicit/)
    expect(() =>
      assertCoverage([...clientCacheRpcCachePolicies, clientCacheRpcCachePolicies[0]]),
    ).toThrow(/more than one/)
    expect(() =>
      createRpcCachePolicyInterceptor([
        clientCacheRpcCachePolicies[0],
        clientCacheRpcCachePolicies[0],
      ]),
    ).toThrow(/more than one/)
    expect(() =>
      assertCoverage([
        ...clientCacheRpcCachePolicies,
        { method: MemoryService.method.release, policy: userScopedUnaryReadPolicy },
      ]),
    ).toThrow(/not a unary NO_SIDE_EFFECTS/)
    expect(() =>
      assertCoverage(
        clientCacheRpcCachePolicies.map((entry) =>
          entry.method === MemoryService.method.getUniverse
            ? { ...entry, policy: unaryWritePolicy }
            : entry,
        ),
      ),
    ).toThrow(/incompatible/)
    expect(() =>
      assertCoverage(
        clientCacheRpcCachePolicies.map((entry) =>
          entry.method === TwinkleService.method.getBalance
            ? { ...entry, policy: idempotentUnaryReadPolicy }
            : entry,
        ),
      ),
    ).toThrow(/private user-scoped/)
    expect(() =>
      assertCoverage(
        clientCacheRpcCachePolicies.map((entry) =>
          entry.method === TwinkleService.method.getBalance
            ? { ...entry, policy: { ...userScopedUnaryReadPolicy, sharedCdn: true } }
            : entry,
        ),
      ),
    ).toThrow(/shared or public CDN/)
  })

  it('sends all newly classified reads through the production auth, policy, and telemetry chain', async () => {
    const runtime = globalThis as unknown as {
      Response: new (body: string, init: unknown) => unknown
      Headers: new (init?: unknown) => { get(name: string): string | null }
    }
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new runtime.Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-request-id': 'policy-request' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const auth = {
      getAccessToken: vi.fn(async () => 'token-1'),
    } as unknown as AuthFacade
    const observability = createObservabilityFacade()

    try {
      const transport = resolveClientCacheTransport({
        baseUrl: 'https://api.example.test',
        auth,
        observability,
      })
      const memory = createMemoryClient(transport)
      const twinkle = createTwinkleClient(transport)

      await twinkle.getBalance({})
      await twinkle.quoteSpend({ kind: SpendKind.RECALL, episodicMemoryId: 'memory-1' })
      await memory.getProvenance({ episodicMemoryId: 'memory-1' })
      await memory.export({})
      await memory.getDiaries({})
      await memory.release({ diaryId: 'diary-1' })

      expect(fetchMock).toHaveBeenCalledTimes(6)
      const calls = fetchMock.mock.calls as unknown as Array<
        [string, { method?: string; headers?: unknown }]
      >
      for (const [, init] of calls.slice(0, 5)) {
        expect(init.method).toBe('GET')
        expect(new runtime.Headers(init.headers).get('Authorization')).toBe('Bearer token-1')
      }
      expect(calls[5][1].method).toBe('POST')
      expect(new runtime.Headers(calls[5][1].headers).get('Authorization')).toBe('Bearer token-1')
      expect(observability.snapshot.requestId).toBe('policy-request')
      expect(auth.getAccessToken).toHaveBeenCalledTimes(6)
    } finally {
      vi.unstubAllGlobals()
      observability.dispose()
    }
  })

  it('keeps memory cache keys aligned with the API-client facade', () => {
    const context = createClientCacheTestContext()
    const key = memoryCacheKeys.getUniverse(context.transport)

    expect(isConnectQueryKey(key)).toBe(true)
    expect(key[1].methodName).toBe('GetUniverse')
    expect(createGetUniverseQueryOptions(context.transport).queryKey).toEqual(key)
    expect(memoryCacheKeys.service()[1].serviceName).toContain('MemoryService')
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
    expect(rpcMethodPolicyKey(PlatformService.method.ping)).toBe(
      'cosimosi.platform.v1.PlatformService/Ping',
    )
    await expect(
      callPolicyInterceptor(createClientCacheRpcPolicyInterceptor(), 'POST'),
    ).resolves.toBe(true)
    await expect(callPolicyInterceptor(createRpcCachePolicyInterceptor([]), 'GET')).rejects.toThrow(
      /without an explicit/,
    )
    await expect(
      callPolicyInterceptor(createRpcCachePolicyInterceptor([]), 'POST'),
    ).rejects.toThrow(/without an explicit/)
    await expect(
      callPolicyInterceptor(
        createRpcCachePolicyInterceptor([
          { method: PlatformService.method.ping, policy: unaryWritePolicy },
        ]),
        'POST',
      ),
    ).rejects.toThrow(/registered with a POST/)
    await expect(
      callPolicyInterceptor(
        createRpcCachePolicyInterceptor([
          { method: nonIdempotentMethod, policy: idempotentUnaryReadPolicy },
        ]),
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
  methodKind: 'unary',
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
