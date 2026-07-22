import type { Interceptor } from '@connectrpc/connect'

import {
  AccountService,
  MemoryService,
  PlatformService,
  TwinkleService,
  apiServiceDescriptors,
} from '@cosimosi/api-client'

export type RpcCacheMethod = 'GET' | 'POST'

export interface RpcCachePolicy {
  idempotent: boolean
  method: RpcCacheMethod
  sharedCdn: boolean
  userScoped: boolean
}

export interface RpcMethodDescriptor {
  readonly name: string
  readonly idempotency: number
  readonly methodKind: string
  readonly parent: {
    readonly typeName: string
  }
}

export interface RpcServiceDescriptor {
  readonly methods: readonly RpcMethodDescriptor[]
}

export interface RpcCachePolicyEntry {
  method: RpcMethodDescriptor
  policy: RpcCachePolicy
}

const protoNoSideEffects = 1 // google.protobuf.MethodOptions.NO_SIDE_EFFECTS

export function defineRpcCachePolicy(policy: RpcCachePolicy): RpcCachePolicy {
  if (policy.method === 'GET' && !policy.idempotent) {
    throw new Error('Only idempotent unary reads may use HTTP GET')
  }
  if (policy.userScoped && policy.sharedCdn) {
    throw new Error('User-scoped RPC data must not be configured for shared or public CDN caching')
  }
  return policy
}

export function createRpcCachePolicyInterceptor(
  entries: readonly RpcCachePolicyEntry[],
): Interceptor {
  const policies = new Map<string, RpcCachePolicy>()
  for (const entry of entries) {
    const key = rpcMethodPolicyKey(entry.method)
    if (policies.has(key)) throw new Error(`${key} has more than one RPC cache policy`)
    policies.set(key, defineRpcCachePolicy(entry.policy))
  }

  return (next) => async (req) => {
    const methodKey = rpcMethodPolicyKey(req.method)
    const policy = policies.get(methodKey)
    const mayUseHttpGet = req.method.idempotency === protoNoSideEffects
    if (!policy) {
      if (mayUseHttpGet || req.requestMethod === 'GET') {
        throw new Error(`${methodKey} uses HTTP GET without an explicit RPC cache policy`)
      }
      return next(req)
    }
    if (policy.method === 'GET' && !mayUseHttpGet) {
      throw new Error(`${methodKey} uses HTTP GET without proto NO_SIDE_EFFECTS idempotency`)
    }
    if (policy.method !== 'GET' && mayUseHttpGet) {
      throw new Error(
        `${methodKey} has proto NO_SIDE_EFFECTS idempotency but is registered with a POST cache policy`,
      )
    }
    return next(req)
  }
}

export function createClientCacheRpcPolicyInterceptor(): Interceptor {
  assertRpcCachePolicyCoverage(
    apiServiceDescriptors,
    clientCacheRpcCachePolicies,
    platformPublicRpcReads,
  )
  return createRpcCachePolicyInterceptor(clientCacheRpcCachePolicies)
}

export function rpcMethodPolicyKey(method: RpcMethodDescriptor): string {
  return `${method.parent.typeName}/${method.name}`
}

export const idempotentUnaryReadPolicy = defineRpcCachePolicy({
  idempotent: true,
  method: 'GET',
  sharedCdn: false,
  userScoped: false,
})

export const unaryWritePolicy = defineRpcCachePolicy({
  idempotent: false,
  method: 'POST',
  sharedCdn: false,
  userScoped: true,
})

// GET-eligible read over user-scoped data: privately cacheable, never shared CDN (§2.7/§4).
export const userScopedUnaryReadPolicy = defineRpcCachePolicy({
  ...idempotentUnaryReadPolicy,
  userScoped: true,
})

export const platformRpcCachePolicies = [
  {
    method: PlatformService.method.ping,
    policy: idempotentUnaryReadPolicy,
  },
] as const satisfies readonly RpcCachePolicyEntry[]

export const memoryRpcCachePolicies = [
  {
    method: MemoryService.method.getUniverse,
    policy: userScopedUnaryReadPolicy,
  },
  {
    method: MemoryService.method.getProvenance,
    policy: userScopedUnaryReadPolicy,
  },
  {
    method: MemoryService.method.export,
    policy: userScopedUnaryReadPolicy,
  },
  {
    method: MemoryService.method.getDiaries,
    policy: userScopedUnaryReadPolicy,
  },
  {
    method: MemoryService.method.syncStatus,
    policy: userScopedUnaryReadPolicy,
  },
] as const satisfies readonly RpcCachePolicyEntry[]

export const twinkleRpcCachePolicies = [
  {
    method: TwinkleService.method.getBalance,
    policy: userScopedUnaryReadPolicy,
  },
  {
    method: TwinkleService.method.quoteSpend,
    policy: userScopedUnaryReadPolicy,
  },
] as const satisfies readonly RpcCachePolicyEntry[]

// The palette-preference read is GET-eligible but per-user — privately cacheable, never shared CDN
// (§2.7/§4). The set is a plain POST and needs no entry (a non-idempotent write is passed through).
export const accountRpcCachePolicies = [
  {
    method: AccountService.method.getPalettePreference,
    policy: userScopedUnaryReadPolicy,
  },
] as const satisfies readonly RpcCachePolicyEntry[]

export const clientCacheRpcCachePolicies = [
  ...platformRpcCachePolicies,
  ...memoryRpcCachePolicies,
  ...twinkleRpcCachePolicies,
  ...accountRpcCachePolicies,
] as const satisfies readonly RpcCachePolicyEntry[]

export const platformPublicRpcReads = [PlatformService.method.ping] as const

export function assertRpcCachePolicyCoverage(
  services: readonly RpcServiceDescriptor[],
  entries: readonly RpcCachePolicyEntry[],
  publicReads: readonly RpcMethodDescriptor[] = [],
): void {
  const generatedMethods = new Map<string, RpcMethodDescriptor>()
  for (const service of services) {
    for (const method of service.methods) generatedMethods.set(rpcMethodPolicyKey(method), method)
  }

  const publicReadKeys = new Set(publicReads.map(rpcMethodPolicyKey))
  const policies = new Map<string, RpcCachePolicy>()
  for (const entry of entries) {
    const key = rpcMethodPolicyKey(entry.method)
    if (policies.has(key)) throw new Error(`${key} has more than one RPC cache policy`)
    const generatedMethod = generatedMethods.get(key)
    if (!generatedMethod)
      throw new Error(`${key} is not part of the generated API service inventory`)
    if (
      generatedMethod.methodKind !== 'unary' ||
      generatedMethod.idempotency !== protoNoSideEffects
    ) {
      throw new Error(`${key} is not a unary NO_SIDE_EFFECTS read`)
    }

    const policy = defineRpcCachePolicy(entry.policy)
    if (!policy.idempotent || policy.method !== 'GET') {
      throw new Error(`${key} has an incompatible RPC read policy`)
    }
    if (publicReadKeys.has(key)) {
      if (policy.userScoped)
        throw new Error(`${key} is public but has a user-scoped RPC cache policy`)
    } else if (!policy.userScoped || policy.sharedCdn) {
      throw new Error(`${key} must use a private user-scoped RPC cache policy`)
    }
    policies.set(key, policy)
  }

  for (const method of generatedMethods.values()) {
    if (method.methodKind !== 'unary' || method.idempotency !== protoNoSideEffects) continue
    const key = rpcMethodPolicyKey(method)
    if (!policies.has(key)) throw new Error(`${key} has no explicit RPC cache policy`)
  }
}
