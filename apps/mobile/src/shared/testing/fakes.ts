import {type ApiTransport} from '@cosimosi/api-client';
import {FakeAuthAdapter, createAuthFacade, type AuthFacade, type AuthSession} from '@cosimosi/auth';
import {
  createClientCacheTestContext,
  type ClientCacheQueryClient,
  type ClientCacheTestContextOptions,
} from '@cosimosi/client-cache';
import {createObservabilityFacade, platformFeatureFlags, type ObservabilityFacade} from '@cosimosi/observability';

import {createInMemorySecureTokenStorage, type SecureTokenStorage} from '../native/index.ts';

const DEFAULT_FAKE_AUTH_TTL_MS = 60_000;

export interface CreateMobileShellFakesOptions {
  userId?: string;
  expiresAt?: number;
  ping?: ClientCacheTestContextOptions['ping'];
  /** Override the diagnostics-surface flag default (off) so the surface renders. */
  diagnosticsEnabled?: boolean;
}

export interface MobileShellFakes {
  authFacade: AuthFacade;
  queryClient: ClientCacheQueryClient;
  transport: ApiTransport;
  observabilityFacade: ObservabilityFacade;
  secureStorage: SecureTokenStorage;
  dispose(): void;
}

/**
 * Fake adapters for the mobile app-shell host test (plan/13 A4) — fake auth,
 * transport, storage, locale source, and observability. No Supabase, no network,
 * no native bridge, so the shell renders without an emulator.
 */
export function createMobileShellFakes(options: CreateMobileShellFakesOptions = {}): MobileShellFakes {
  const ping = options.ping ?? (() => ({message: 'pong', requestId: 'mobile-shell-fake'}));
  const authFacade = createAuthFacade({
    adapter: new FakeAuthAdapter({initial: createInitialFakeSession(options)}),
  });
  const cache = createClientCacheTestContext({ping});
  const flagRegistry = options.diagnosticsEnabled
    ? platformFeatureFlags.withOverrides({'platform.diagnosticsSurface': true})
    : platformFeatureFlags;
  const observabilityFacade = createObservabilityFacade({flagRegistry});
  return {
    authFacade,
    queryClient: cache.queryClient,
    transport: cache.transport,
    observabilityFacade,
    secureStorage: createInMemorySecureTokenStorage(),
    dispose() {
      authFacade.dispose();
      cache.queryClient.clear();
      observabilityFacade.dispose();
    },
  };
}

function createInitialFakeSession(options: CreateMobileShellFakesOptions): AuthSession | null {
  if (!options.userId) return null;
  return {
    userId: options.userId,
    expiresAt: options.expiresAt ?? Date.now() + DEFAULT_FAKE_AUTH_TTL_MS,
  };
}
