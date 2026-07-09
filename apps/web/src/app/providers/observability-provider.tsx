import { useEffect, useRef, useState, type ReactNode } from 'react'

import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

import {
  captureContext,
  createObservabilityRuntime,
  platformFeatureFlags,
  readFeatureFlagOverrides,
  type FeatureFlagDefinition,
  type ObservabilityFacade,
  type ObservabilityRuntime,
  type TelemetryAdapter,
  toSentryLevel,
} from '@cosimosi/observability'
import {
  ObservabilityProvider,
  useObservabilityFacade,
  useObservabilitySnapshot,
} from '@cosimosi/observability/react'

import { useSessionSnapshot } from '../../shared/auth/index.ts'

interface WebObservabilityProviderProps {
  children?: ReactNode
  facade?: ObservabilityFacade
}

export function WebObservabilityProvider({ children, facade }: WebObservabilityProviderProps) {
  const [runtime] = useState<ObservabilityRuntime | null>(() =>
    facade ? null : createDefaultWebObservabilityRuntime(),
  )
  const vendorStarted = useRef(false)

  useEffect(() => {
    if (facade || !runtime || vendorStarted.current) return
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

  return (
    <ObservabilityProvider facade={facade ?? runtime!.facade}>{children}</ObservabilityProvider>
  )
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

function createDefaultWebObservabilityRuntime(): ObservabilityRuntime {
  const flagRegistry = platformFeatureFlags.withOverrides(
    readFeatureFlagOverrides(
      platformFeatureFlags.definitions,
      import.meta.env,
      'VITE_COSIMOSI_FLAG_',
    ),
  )
  return createObservabilityRuntime({ flagRegistry })
}

interface WebVendorTelemetryOptions {
  sentryDsn?: string
  release?: string
  posthogKey?: string
  posthogHost?: string
}

function createWebVendorTelemetryAdapter(
  options: WebVendorTelemetryOptions,
): TelemetryAdapter | null {
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
      Sentry.captureException(error, captureContext('web', context))
    },
    captureMessage(message, level, context) {
      if (!sentryEnabled) return
      Sentry.captureMessage(message, {
        ...captureContext('web', context),
        level: toSentryLevel(level),
      })
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
