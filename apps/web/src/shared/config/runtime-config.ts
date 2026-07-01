import { type PlatformFeatureFlagKey } from '@cosimosi/observability'

/**
 * Web runtime configuration seam. Which feature flag gates the /test harness is an
 * architecture/runtime concern, not numeric product tuning — so it lives here, not
 * in spec/values.yaml. Web and mobile read the same flag key through the
 * observability facade, so the two shells gate their dev surface identically.
 */

/** Feature flag that gates whether the /test verification harness is reachable. */
export const diagnosticsSurfaceFlag: PlatformFeatureFlagKey = 'platform.diagnosticsSurface'
