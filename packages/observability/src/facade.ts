import {
  normalizeTelemetryProperties,
  type SafeTelemetryProperties,
  type TelemetryPropertyBag,
} from './safe-properties.ts'
import {
  platformFeatureFlags,
  type FeatureFlagDefinition,
  type FeatureFlagRegistry,
} from './flags.ts'

export type TelemetryLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal'
export type ConsentState = 'denied' | 'granted'

export interface TelemetryContext<T extends TelemetryPropertyBag = TelemetryPropertyBag> {
  readonly source?: string
  readonly properties?: SafeTelemetryProperties<T>
}

export interface ObservabilitySnapshot {
  readonly consent: ConsentState
  readonly requestId: string | null
  readonly blockedAnalyticsCalls: number
}

export interface TelemetryAdapter {
  captureException(error: unknown, context: TelemetryContext): void
  captureMessage(message: string, level: TelemetryLevel, context: TelemetryContext): void
  track(eventName: string, properties: TelemetryPropertyBag): void
  identify(userId: string, traits: TelemetryPropertyBag): void
  resetIdentity(): void
  setAnalyticsConsent?(consent: ConsentState): void
  getFeatureFlag?(definition: FeatureFlagDefinition): FeatureFlagValueFromAdapter
}

export type FeatureFlagValueFromAdapter = boolean | undefined

export interface ObservabilityFacade<K extends string = string> {
  readonly snapshot: ObservabilitySnapshot
  captureException<const T extends TelemetryPropertyBag>(
    error: unknown,
    context?: TelemetryContext<T>,
  ): void
  captureMessage<const T extends TelemetryPropertyBag>(
    message: string,
    level?: TelemetryLevel,
    context?: TelemetryContext<T>,
  ): void
  track<const T extends TelemetryPropertyBag>(
    eventName: string,
    properties?: SafeTelemetryProperties<T>,
  ): boolean
  identify<const T extends TelemetryPropertyBag>(
    userId: string,
    traits?: SafeTelemetryProperties<T>,
  ): boolean
  resetIdentity(): void
  setConsent(consent: ConsentState): void
  setRequestId(requestId: string | null): void
  getFeatureFlag(key: K): boolean
  subscribe(listener: () => void): () => void
  dispose(): void
}

export interface CreateObservabilityFacadeOptions<K extends string> {
  adapters?: readonly TelemetryAdapter[]
  flagRegistry?: FeatureFlagRegistry<K>
}

export function createObservabilityFacade<
  K extends string = (typeof platformFeatureFlags.definitions)[number]['key'],
>({
  adapters = [],
  flagRegistry = platformFeatureFlags as FeatureFlagRegistry<K>,
}: CreateObservabilityFacadeOptions<K> = {}): ObservabilityFacade<K> {
  let snapshot: ObservabilitySnapshot = {
    consent: 'denied',
    requestId: null,
    blockedAnalyticsCalls: 0,
  }
  const listeners = new Set<() => void>()
  let disposed = false

  function emit() {
    for (const listener of listeners) listener()
  }

  function withRequestId<T extends TelemetryPropertyBag>(
    context: TelemetryContext<T> = {},
  ): TelemetryContext {
    const properties = normalizeTelemetryProperties(context.properties)
    if (snapshot.requestId && properties.requestId === undefined) {
      properties.requestId = snapshot.requestId
    }
    return { ...context, properties }
  }

  function withSafeError(
    error: unknown,
    context: TelemetryContext,
  ): { error: Error; context: TelemetryContext } {
    const safeError = redactedTelemetryError(error)
    const properties = normalizeTelemetryProperties(context.properties)
    if (properties.errorName === undefined) properties.errorName = safeError.name
    return { error: safeError, context: { ...context, properties } }
  }

  function blockAnalyticsCall(): boolean {
    snapshot = { ...snapshot, blockedAnalyticsCalls: snapshot.blockedAnalyticsCalls + 1 }
    emit()
    return false
  }

  return {
    get snapshot() {
      return snapshot
    },
    captureException(error, context) {
      if (disposed) return
      const safe = withSafeError(error, withRequestId(context))
      for (const adapter of adapters) adapter.captureException(safe.error, safe.context)
    },
    captureMessage(message, level = 'info', context) {
      if (disposed) return
      const safeContext = withRequestId(context)
      for (const adapter of adapters) adapter.captureMessage(message, level, safeContext)
    },
    track(eventName, properties) {
      if (disposed) return false
      const safeProperties = normalizeTelemetryProperties(properties)
      if (snapshot.requestId && safeProperties.requestId === undefined)
        safeProperties.requestId = snapshot.requestId
      if (snapshot.consent !== 'granted') return blockAnalyticsCall()
      for (const adapter of adapters) adapter.track(eventName, safeProperties)
      return true
    },
    identify(userId, traits) {
      if (disposed) return false
      const safeTraits = normalizeTelemetryProperties(traits)
      if (snapshot.consent !== 'granted') return blockAnalyticsCall()
      for (const adapter of adapters) adapter.identify(userId, safeTraits)
      return true
    },
    resetIdentity() {
      if (disposed) return
      for (const adapter of adapters) adapter.resetIdentity()
    },
    setConsent(consent) {
      if (disposed || snapshot.consent === consent) return
      snapshot = { ...snapshot, consent }
      for (const adapter of adapters) {
        adapter.setAnalyticsConsent?.(consent)
        if (consent === 'denied') adapter.resetIdentity()
      }
      emit()
    },
    setRequestId(requestId) {
      if (disposed || snapshot.requestId === requestId) return
      snapshot = { ...snapshot, requestId }
      emit()
    },
    getFeatureFlag(key) {
      const definition = flagRegistry.getDefinition(key)
      if (snapshot.consent !== 'granted' && requiresConsentForRemoteFlag(definition))
        return flagRegistry.resolve(key)
      for (const adapter of adapters) {
        const remoteValue = adapter.getFeatureFlag?.(definition)
        if (remoteValue !== undefined) return flagRegistry.resolve(key, remoteValue)
      }
      return flagRegistry.resolve(key)
    },
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
    },
  }
}

function requiresConsentForRemoteFlag(definition: FeatureFlagDefinition): boolean {
  return definition.kind !== 'kill-switch' && definition.kind !== 'operational'
}

function redactedTelemetryError(error: unknown): Error {
  const name = error instanceof Error ? safeErrorName(error.name) : 'Error'
  const safeError = new Error('operational error')
  safeError.name = name
  safeError.stack = undefined
  return safeError
}

function safeErrorName(name: string): string {
  return /^[A-Za-z][A-Za-z0-9_.:-]{0,80}$/.test(name) ? name : 'Error'
}
