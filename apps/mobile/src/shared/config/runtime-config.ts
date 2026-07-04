import {Platform} from 'react-native';

import {
  platformFeatureFlags,
  readFeatureFlagOverrides,
  type FeatureFlagValue,
  type PlatformFeatureFlagKey,
} from '@cosimosi/observability';

import {MOBILE_DEV_USER_ID} from './dev-user.gen.ts';

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
 * Dev sign-in bypass user id (local only), NODE_ENV-gated (Metro inlines NODE_ENV) so a release
 * build never gets a bypass user. Single-sourced from the root `.env` `COSIMOSI_DEV_USER_ID` via
 * the generated `dev-user.gen.ts` (regenerated on mobile dev start), so web, api, and mobile
 * share ONE id with no hand-sync — override `COSIMOSI_DEV_USER_ID` once and all three follow, and
 * the api's dev verifier keeps accepting the mobile fake token. Defaults to 'dev-user' (the seed
 * user, scripts/seed-dev-universe.sql) when unset. Undefined in production → falls back to real auth.
 */
export const mobileDevUserId: string | undefined =
  process.env.NODE_ENV === 'production' ? undefined : MOBILE_DEV_USER_ID;

export type MobileFeatureFlagEnv = Record<string, string | boolean | undefined>;

export function readMobileFeatureFlagOverrides(
  env: MobileFeatureFlagEnv = defaultMobileFeatureFlagEnv(),
): Partial<Record<PlatformFeatureFlagKey, FeatureFlagValue>> {
  return readFeatureFlagOverrides(platformFeatureFlags.definitions, env);
}

function defaultMobileFeatureFlagEnv(): MobileFeatureFlagEnv {
  return ((globalThis as typeof globalThis & {process?: {env?: MobileFeatureFlagEnv}}).process?.env ?? {});
}
