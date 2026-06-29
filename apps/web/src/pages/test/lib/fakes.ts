import type { ApiTransport } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade, type AuthFacade, type AuthSession } from '@cosimosi/auth'
import {
  createClientCacheTestContext,
  type ClientCacheQueryClient,
  type ClientCacheTestContextOptions,
} from '@cosimosi/client-cache'

const DEFAULT_FAKE_AUTH_TTL_MS = 60_000
const DEFAULT_TEST_HARNESS_PING: NonNullable<ClientCacheTestContextOptions['ping']> = () => ({
  message: 'pong',
  requestId: 'test-harness-fake',
})

export interface CreateTestHarnessFakesOptions {
  userId?: string
  expiresAt?: number
  ping?: ClientCacheTestContextOptions['ping']
}

export interface TestHarnessFakes {
  authFacade: AuthFacade
  queryClient: ClientCacheQueryClient
  transport: ApiTransport
  dispose(): void
}

export function createTestHarnessFakes(options: CreateTestHarnessFakesOptions = {}): TestHarnessFakes {
  const authFacade = createAuthFacade({
    adapter: new FakeAuthAdapter({
      initial: createInitialFakeSession(options),
    }),
  })
  const cache = createClientCacheTestContext({
    ping: options.ping ?? DEFAULT_TEST_HARNESS_PING,
  })
  return {
    authFacade,
    queryClient: cache.queryClient,
    transport: cache.transport,
    dispose() {
      authFacade.dispose()
      cache.queryClient.clear()
    },
  }
}

function createInitialFakeSession(options: CreateTestHarnessFakesOptions): AuthSession | null {
  if (!options.userId) return null
  return {
    userId: options.userId,
    expiresAt: options.expiresAt ?? Date.now() + DEFAULT_FAKE_AUTH_TTL_MS,
  }
}
