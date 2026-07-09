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

export function createInMemoryTelemetryAdapter(): InMemoryTelemetryAdapter {
  const events: InMemoryTelemetryEvent[] = []
  const featureFlags = new Map<string, boolean>()

  return {
    get events() {
      return events
    },
    captureException(error, context) {
      events.push({ kind: 'exception', error, context })
    },
    captureMessage(message, level, context) {
      events.push({ kind: 'message', message, level, context })
    },
    track(eventName, properties) {
      events.push({ kind: 'track', eventName, properties })
    },
    identify(userId, traits) {
      events.push({ kind: 'identify', userId, traits })
    },
    resetIdentity() {
      events.push({ kind: 'resetIdentity' })
    },
    setAnalyticsConsent(consent) {
      events.push({ kind: 'consent', consent })
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
