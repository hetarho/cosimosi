import type { ConsentState, TelemetryAdapter, TelemetryContext, TelemetryLevel } from './facade.ts'
import type { FeatureFlagDefinition } from './flags.ts'
import type { TelemetryPropertyBag } from './safe-properties.ts'

export type InMemoryTelemetryEvent =
  | {
      readonly kind: 'exception'
      readonly error: unknown
      readonly context: TelemetryContext
    }
  | {
      readonly kind: 'message'
      readonly message: string
      readonly level: TelemetryLevel
      readonly context: TelemetryContext
    }
  | {
      readonly kind: 'track'
      readonly eventName: string
      readonly properties: TelemetryPropertyBag
    }
  | {
      readonly kind: 'identify'
      readonly userId: string
      readonly traits: TelemetryPropertyBag
    }
  | {
      readonly kind: 'resetIdentity'
    }
  | {
      readonly kind: 'consent'
      readonly consent: ConsentState
    }

export interface InMemoryTelemetryAdapter extends TelemetryAdapter {
  readonly events: readonly InMemoryTelemetryEvent[]
  setFeatureFlag(key: string, value: boolean): void
  clear(): void
}

export const DEFAULT_TELEMETRY_HISTORY_LIMIT = 256

export function createInMemoryTelemetryAdapter({
  capacity = DEFAULT_TELEMETRY_HISTORY_LIMIT,
}: { capacity?: number } = {}): InMemoryTelemetryAdapter {
  if (!Number.isSafeInteger(capacity) || capacity < 0)
    throw new RangeError('Invalid telemetry history capacity')
  const events: InMemoryTelemetryEvent[] = []
  const featureFlags = new Map<string, boolean>()
  const record = (event: InMemoryTelemetryEvent) => {
    if (capacity === 0) return
    if (events.length === capacity) events.shift()
    events.push(event)
  }

  return {
    get events() {
      return events
    },
    captureException(error, context) {
      record({ kind: 'exception', error, context })
    },
    captureMessage(message, level, context) {
      record({ kind: 'message', message, level, context })
    },
    track(eventName, properties) {
      record({ kind: 'track', eventName, properties })
    },
    identify(userId, traits) {
      record({ kind: 'identify', userId, traits })
    },
    resetIdentity() {
      record({ kind: 'resetIdentity' })
    },
    setAnalyticsConsent(consent) {
      record({ kind: 'consent', consent })
    },
    getFeatureFlag(definition: FeatureFlagDefinition) {
      return (
        featureFlags.get(definition.key) ?? featureFlags.get(definition.remoteKey ?? definition.key)
      )
    },
    setFeatureFlag(key, value) {
      featureFlags.set(key, value)
    },
    clear() {
      events.length = 0
      featureFlags.clear()
    },
  }
}
