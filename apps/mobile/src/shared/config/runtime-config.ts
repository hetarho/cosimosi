import {Platform} from 'react-native';

import {
  platformFeatureFlags,
  readFeatureFlagOverrides,
  type FeatureFlagValue,
  type PlatformFeatureFlagKey,
} from '@cosimosi/observability';

/**
 * Mobile runtime configuration seam. Base URL, app-version label, and which
 * feature flag gates the diagnostics surface are architecture/runtime concerns,
 * not numeric product tuning — so they live here, not in spec/values.yaml.
 */

/**
 * Dev API base URL. Android emulators reach the host loopback via 10.0.2.2; the
 * iOS simulator shares the host's localhost. Production builds inject a real base
 * URL through the same resolver boundary.
 */
export function resolveMobileApiBaseUrl(platformOS: typeof Platform.OS = Platform.OS): string {
  return platformOS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

/**
 * App version/build label for the diagnostics surface (no secrets). Placeholder
 * kept in sync with package.json until a native build-version source is wired at
 * deployment.
 */
export const mobileAppVersion = '0.0.1';

/** Feature flag that gates whether the diagnostics surface is reachable. */
export const diagnosticsSurfaceFlag: PlatformFeatureFlagKey = 'platform.diagnosticsSurface';

/**
 * Dev sign-in bypass user id (local only). Mirrors the web's VITE_DEV_USER_ID so `pnpm ios`
 * sees the same seeded universe (scripts/seed-dev-universe.sql) without a Supabase login.
 * NODE_ENV-gated (Metro inlines it) so a release build never gets a bypass user; the id must
 * match the api's COSIMOSI_DEV_USER_ID. Undefined in production → falls back to real auth.
 */
export const mobileDevUserId: string | undefined =
  process.env.NODE_ENV === 'production' ? undefined : 'dev-user';

export type MobileFeatureFlagEnv = Record<string, string | boolean | undefined>;

export function readMobileFeatureFlagOverrides(
  env: MobileFeatureFlagEnv = defaultMobileFeatureFlagEnv(),
): Partial<Record<PlatformFeatureFlagKey, FeatureFlagValue>> {
  return readFeatureFlagOverrides(platformFeatureFlags.definitions, env);
}

function defaultMobileFeatureFlagEnv(): MobileFeatureFlagEnv {
  return ((globalThis as typeof globalThis & {process?: {env?: MobileFeatureFlagEnv}}).process?.env ?? {});
}
