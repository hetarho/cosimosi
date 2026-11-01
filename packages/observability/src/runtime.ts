import { createInMemoryTelemetryAdapter, type InMemoryTelemetryAdapter } from './memory-adapter.ts'
import {
  createObservabilityFacade,
  type ObservabilityFacade,
  type TelemetryAdapter,
  type TelemetryContext,
  type TelemetryLevel,
} from './facade.ts'
import {
  platformFeatureFlags,
  type FeatureFlagRegistry,
  type PlatformFeatureFlagKey,
} from './flags.ts'
import type { TelemetryPropertyBag } from './safe-properties.ts'

export interface ObservabilityRuntime {
  readonly facade: ObservabilityFacade
  readonly memoryAdapter: InMemoryTelemetryAdapter
  setVendorAdapter(adapter: TelemetryAdapter | null): void
}

export interface CreateObservabilityRuntimeOptions {
  flagRegistry?: FeatureFlagRegistry<PlatformFeatureFlagKey>
  historyCapacity?: number
}

export function createObservabilityRuntime({
  flagRegistry = platformFeatureFlags,
  historyCapacity = 0,
}: CreateObservabilityRuntimeOptions = {}): ObservabilityRuntime {
  const memoryAdapter = createInMemoryTelemetryAdapter({ capacity: historyCapacity })
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

export function createDelegatedTelemetryAdapter(
  getAdapter: () => TelemetryAdapter | null,
): TelemetryAdapter {
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

export interface TelemetryBinding {
  readonly adapter: TelemetryAdapter | null
  dispose(): Promise<void>
}

/** Serializes SDK close/init while making canceled effect setups inert. */
export function createTelemetryBindingManager(runtime: ObservabilityRuntime) {
  let work = Promise.resolve()
  let installed: TelemetryBinding | null = null
  const report = (error: unknown) =>
    runtime.facade.captureException(error, { source: 'telemetry-lifecycle' })
  return {
    replace(createBinding: () => TelemetryBinding | Promise<TelemetryBinding>): () => void {
      let canceled = false
      let owned: TelemetryBinding | null = null
      work = work
        .then(async () => {
          if (canceled) return
          owned = await createBinding()
          if (canceled) {
            await owned.dispose()
            owned = null
            return
          }
          installed = owned
          runtime.setVendorAdapter(owned.adapter)
        })
        .catch(report)
      return () => {
        canceled = true
        if (installed === owned) {
          runtime.setVendorAdapter(null)
          installed = null
        }
        work = work
          .then(async () => {
            await owned?.dispose()
            owned = null
          })
          .catch(report)
      }
    },
    settled: () => work,
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

export function stringTelemetryProperty(
  properties: TelemetryPropertyBag | undefined,
  key: string,
): string | undefined {
  const value = properties?.[key]
  return typeof value === 'string' ? value : undefined
}

export function toSentryLevel(level: TelemetryLevel) {
  return level === 'warning' ? 'warning' : level
}
