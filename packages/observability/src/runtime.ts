import {
  createInMemoryTelemetryAdapter,
  type InMemoryTelemetryAdapter,
} from './memory-adapter.ts'
import {
  createObservabilityFacade,
  type ObservabilityFacade,
  type TelemetryAdapter,
  type TelemetryContext,
  type TelemetryLevel,
} from './facade.ts'
import { platformFeatureFlags, type FeatureFlagRegistry, type PlatformFeatureFlagKey } from './flags.ts'
import type { TelemetryPropertyBag } from './safe-properties.ts'

export interface ObservabilityRuntime {
  readonly facade: ObservabilityFacade
  readonly memoryAdapter: InMemoryTelemetryAdapter
  setVendorAdapter(adapter: TelemetryAdapter | null): void
}

export interface CreateObservabilityRuntimeOptions {
  flagRegistry?: FeatureFlagRegistry<PlatformFeatureFlagKey>
}

export function createObservabilityRuntime({
  flagRegistry = platformFeatureFlags,
}: CreateObservabilityRuntimeOptions = {}): ObservabilityRuntime {
  const memoryAdapter = createInMemoryTelemetryAdapter()
  let vendorAdapter: TelemetryAdapter | null = null
  const delegatedVendorAdapter = createDelegatedTelemetryAdapter(() => vendorAdapter)
  const facade = createObservabilityFacade({
    adapters: [memoryAdapter, delegatedVendorAdapter],
    flagRegistry,
  })
  return {
    facade,
    memoryAdapter,
    setVendorAdapter(adapter) {
      vendorAdapter = adapter
      adapter?.setAnalyticsConsent?.(facade.snapshot.consent)
    },
  }
}

export function createDelegatedTelemetryAdapter(getAdapter: () => TelemetryAdapter | null): TelemetryAdapter {
  return {
    captureException(error, context) {
      getAdapter()?.captureException(error, context)
    },
    captureMessage(message, level, context) {
      getAdapter()?.captureMessage(message, level, context)
    },
    track(eventName, properties) {
      getAdapter()?.track(eventName, properties)
    },
    identify(userId, traits) {
      getAdapter()?.identify(userId, traits)
    },
    resetIdentity() {
      getAdapter()?.resetIdentity()
    },
    setAnalyticsConsent(consent) {
      getAdapter()?.setAnalyticsConsent?.(consent)
    },
    getFeatureFlag(definition) {
      return getAdapter()?.getFeatureFlag?.(definition)
    },
  }
}

export function captureContext(surface: string, context: TelemetryContext) {
  return {
    tags: {
      source: context.source ?? surface,
      request_id: stringTelemetryProperty(context.properties, 'requestId'),
    },
    extra: context.properties,
  }
}

export function stringTelemetryProperty(properties: TelemetryPropertyBag | undefined, key: string): string | undefined {
  const value = properties?.[key]
  return typeof value === 'string' ? value : undefined
}

export function toSentryLevel(level: TelemetryLevel) {
  return level === 'warning' ? 'warning' : level
}
