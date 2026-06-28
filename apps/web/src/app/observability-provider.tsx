import { useEffect, useRef, useState, type ReactNode } from 'react'

import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

import {
  createInMemoryTelemetryAdapter,
  createObservabilityFacade,
  platformFeatureFlags,
  readFeatureFlagOverrides,
  type FeatureFlagDefinition,
  type ObservabilityFacade,
  type TelemetryAdapter,
  type TelemetryContext,
  type TelemetryLevel,
  type TelemetryPropertyBag,
} from '@cosimosi/observability'
import { ObservabilityProvider, useObservabilityFacade, useObservabilitySnapshot } from '@cosimosi/observability/react'

import { useSessionSnapshot } from './auth-context.ts'

interface WebObservabilityProviderProps {
  children?: ReactNode
  facade?: ObservabilityFacade
}

export function WebObservabilityProvider({ children, facade }: WebObservabilityProviderProps) {
  const [runtime] = useState(createDefaultWebObservabilityRuntime)
  const vendorStarted = useRef(false)

  useEffect(() => {
    if (facade || vendorStarted.current) return
    runtime.setVendorAdapter(
      createWebVendorTelemetryAdapter({
        sentryDsn: import.meta.env.VITE_SENTRY_DSN,
        release: import.meta.env.VITE_APP_VERSION,
        posthogKey: import.meta.env.VITE_POSTHOG_KEY,
        posthogHost: import.meta.env.VITE_POSTHOG_HOST,
      }),
    )
    vendorStarted.current = true
  }, [facade, runtime])

  return <ObservabilityProvider facade={facade ?? runtime.facade}>{children}</ObservabilityProvider>
}

export function WebObservabilitySessionBridge() {
  const observability = useObservabilityFacade()
  const observabilitySnapshot = useObservabilitySnapshot()
  const session = useSessionSnapshot()

  useEffect(() => {
    if (session.userId) {
      observability.identify(session.userId, { surface: 'web' })
    } else {
      observability.resetIdentity()
    }
  }, [observability, observabilitySnapshot.consent, session.userId])

  return null
}

interface WebObservabilityRuntime {
  readonly facade: ObservabilityFacade
  setVendorAdapter(adapter: TelemetryAdapter | null): void
}

function createDefaultWebObservabilityRuntime(): WebObservabilityRuntime {
  const memoryAdapter = createInMemoryTelemetryAdapter()
  let vendorAdapter: TelemetryAdapter | null = null
  const delegatedVendorAdapter = createDelegatedTelemetryAdapter(() => vendorAdapter)
  const adapters = [memoryAdapter, delegatedVendorAdapter]
  const flagRegistry = platformFeatureFlags.withOverrides(
    readFeatureFlagOverrides(platformFeatureFlags.definitions, import.meta.env, 'VITE_COSIMOSI_FLAG_'),
  )
  const facade = createObservabilityFacade({ adapters, flagRegistry })
  return {
    facade,
    setVendorAdapter(adapter) {
      vendorAdapter = adapter
      adapter?.setAnalyticsConsent?.(facade.snapshot.consent)
    },
  }
}

interface WebVendorTelemetryOptions {
  sentryDsn?: string
  release?: string
  posthogKey?: string
  posthogHost?: string
}

function createWebVendorTelemetryAdapter(options: WebVendorTelemetryOptions): TelemetryAdapter | null {
  const sentryEnabled = Boolean(options.sentryDsn)
  const posthogEnabled = Boolean(options.posthogKey)

  if (sentryEnabled) {
    Sentry.init({
      dsn: options.sentryDsn,
      release: options.release,
      defaultIntegrations: false,
      sendDefaultPii: false,
    })
  }

  if (options.posthogKey) {
    posthog.init(options.posthogKey, {
      api_host: options.posthogHost || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      opt_out_capturing_by_default: true,
    })
  }

  if (!sentryEnabled && !posthogEnabled) return null

  return {
    captureException(error, context) {
      if (!sentryEnabled) return
      Sentry.captureException(error, captureContext(context))
    },
    captureMessage(message, level, context) {
      if (!sentryEnabled) return
      Sentry.captureMessage(message, { ...captureContext(context), level: toSentryLevel(level) })
    },
    track(eventName, properties) {
      if (posthogEnabled) posthog.capture(eventName, properties)
    },
    identify(userId, traits) {
      if (posthogEnabled) posthog.identify(userId, traits)
    },
    resetIdentity() {
      if (posthogEnabled) posthog.reset()
    },
    setAnalyticsConsent(consent) {
      if (!posthogEnabled) return
      if (consent === 'granted') posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    },
    getFeatureFlag(definition: FeatureFlagDefinition) {
      if (!posthogEnabled || !definition.remoteKey) return undefined
      const value = posthog.getFeatureFlag(definition.remoteKey)
      return typeof value === 'boolean' ? value : undefined
    },
  }
}

function createDelegatedTelemetryAdapter(getAdapter: () => TelemetryAdapter | null): TelemetryAdapter {
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

function captureContext(context: TelemetryContext) {
  return {
    tags: {
      source: context.source ?? 'web',
      request_id: stringProperty(context.properties, 'requestId'),
    },
    extra: context.properties,
  }
}

function stringProperty(properties: TelemetryPropertyBag | undefined, key: string): string | undefined {
  const value = properties?.[key]
  return typeof value === 'string' ? value : undefined
}

function toSentryLevel(level: TelemetryLevel) {
  return level === 'warning' ? 'warning' : level
}
