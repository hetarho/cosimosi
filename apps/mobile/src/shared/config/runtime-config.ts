import {Platform} from 'react-native';

import type {PlatformFeatureFlagKey} from '@cosimosi/observability';

/**
 * Mobile runtime configuration seam. Base URL, app-version label, and which
 * feature flag gates the diagnostics surface are architecture/runtime concerns,
 * not numeric product tuning — so they live here, not in spec/values.yaml
 * (plan/13 Policy/Values Impact).
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
 * kept in sync with package.json until a native build-version source (e.g. the
 * platform build config) is wired at deployment — a plan/13 non-goal.
 */
export const mobileAppVersion = '0.0.1';

/** Feature flag (plan/10) that gates whether the diagnostics surface is reachable. */
export const diagnosticsSurfaceFlag: PlatformFeatureFlagKey = 'platform.diagnosticsSurface';
