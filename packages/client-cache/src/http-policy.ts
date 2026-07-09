import type { Interceptor } from '@connectrpc/connect'

import { MemoryService, PlatformService } from '@cosimosi/api-client'

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
  readonly parent: {
    readonly typeName: string
  }
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
  const policies = new Map(
    entries.map((entry) => [rpcMethodPolicyKey(entry.method), defineRpcCachePolicy(entry.policy)]),
  )

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
  return createRpcCachePolicyInterceptor([...platformRpcCachePolicies, ...memoryRpcCachePolicies])
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
] as const satisfies readonly RpcCachePolicyEntry[]
