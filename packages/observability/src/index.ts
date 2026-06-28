export {
  assertSafeTelemetryProperties,
  normalizeTelemetryProperties,
  safeTelemetryProperties,
  sensitiveTelemetryKeys,
  type SafeTelemetryProperties,
  type TelemetryPropertyBag,
  type TelemetryScalar,
  type TelemetryValue,
} from './safe-properties.ts'
export {
  createObservabilityFacade,
  type ConsentState,
  type ObservabilityFacade,
  type ObservabilitySnapshot,
  type TelemetryAdapter,
  type TelemetryContext,
  type TelemetryLevel,
} from './facade.ts'
export {
  defineFeatureFlagRegistry,
  platformFeatureFlags,
  readFeatureFlagOverrides,
  type FeatureFlagDefinition,
  type FeatureFlagKind,
  type FeatureFlagRegistry,
  type FeatureFlagValue,
  type PlatformFeatureFlagKey,
} from './flags.ts'
export {
  createInMemoryTelemetryAdapter,
  type InMemoryTelemetryAdapter,
  type InMemoryTelemetryEvent,
} from './memory-adapter.ts'
export { createTelemetryRequestIdInterceptor, requestIdHeader } from './connect.ts'
