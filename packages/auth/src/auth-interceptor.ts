import type { Interceptor } from '@connectrpc/connect'

import { createApiAuthInterceptor } from '@cosimosi/api-client'

import type { AuthFacade } from './auth-adapter.ts'

/**
 * Connect client interceptor that attaches the current access token to every RPC.
 * Tokens are read at call time, so refresh inside the auth adapter is invisible to
 * feature code: a stale token is replaced before the next request without callers
 * knowing about the lifecycle.
 */
export function createAuthInterceptor(facade: AuthFacade): Interceptor {
  return createApiAuthInterceptor(facade)
}
