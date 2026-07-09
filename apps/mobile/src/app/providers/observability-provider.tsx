import { useEffect, useRef, useState, type ReactNode } from 'react'

import * as Sentry from '@sentry/react-native'

import {
  captureContext,
  createObservabilityRuntime,
  platformFeatureFlags,
  type FeatureFlagDefinition,
  type ObservabilityFacade,
  type ObservabilityRuntime,
  type TelemetryAdapter,
  type TelemetryPropertyBag,
  toSentryLevel,
} from '@cosimosi/observability'
import {
  ObservabilityProvider,
  useObservabilityFacade,
  useObservabilitySnapshot,
} from '@cosimosi/observability/react'

import { useSessionSnapshot } from '@cosimosi/auth/react'

import { readMobileFeatureFlagOverrides } from '../../shared/config/index.ts'

interface MobileObservabilityProviderProps {
  children?: ReactNode
  facade?: ObservabilityFacade
  sentryDsn?: string
  release?: string
  posthog?: MobilePostHogClient
}

interface MobilePostHogClient {
  capture(eventName: string, properties: TelemetryPropertyBag): void
  identify(userId: string, traits?: TelemetryPropertyBag): void
  reset(): void
  optIn?(): void
  optOut?(): void
  getFeatureFlag?(key: string): boolean | string | undefined | null
}

export function MobileObservabilityProvider({
  children,
  facade,
  sentryDsn,
  release,
  posthog,
}: MobileObservabilityProviderProps) {
  const [runtime] = useState<ObservabilityRuntime | null>(() =>
    facade ? null : createDefaultMobileObservabilityRuntime(),
  )
  const vendorConfig = useRef<MobileVendorTelemetryOptions | null>(null)
  const vendorBinding = useRef<MobileVendorTelemetryBinding | null>(null)

  useEffect(() => {
    if (facade || !runtime) return
    const activeRuntime = runtime
    const nextConfig = { sentryDsn, release, posthog }
    if (sameMobileVendorTelemetryOptions(vendorConfig.current, nextConfig)) return
    vendorConfig.current = nextConfig
    let cancelled = false
    async function replaceVendorAdapter() {
      await vendorBinding.current?.dispose()
      if (cancelled) return
      const nextBinding = createMobileVendorTelemetryAdapter(nextConfig)
      activeRuntime.setVendorAdapter(nextBinding.adapter)
      vendorBinding.current = nextBinding
    }
    replaceVendorAdapter()
    return () => {
      cancelled = true
    }
  }, [facade, posthog, release, runtime, sentryDsn])

  return (
    <ObservabilityProvider facade={facade ?? runtime!.facade}>{children}</ObservabilityProvider>
  )
}

export function MobileObservabilitySessionBridge() {
  const observability = useObservabilityFacade()
  const observabilitySnapshot = useObservabilitySnapshot()
  const session = useSessionSnapshot()

  useEffect(() => {
    if (session.userId) {
      observability.identify(session.userId, { surface: 'mobile' })
    } else {
      observability.resetIdentity()
    }
  }, [observability, observabilitySnapshot.consent, session.userId])

  return null
}

interface MobileVendorTelemetryOptions {
  sentryDsn?: string
  release?: string
  posthog?: MobilePostHogClient
}

interface MobileVendorTelemetryBinding {
  readonly adapter: TelemetryAdapter | null
  dispose(): Promise<void>
}

function createDefaultMobileObservabilityRuntime(): ObservabilityRuntime {
  return createObservabilityRuntime({
    flagRegistry: platformFeatureFlags.withOverrides(readMobileFeatureFlagOverrides()),
  })
}

function createMobileVendorTelemetryAdapter({
  sentryDsn,
  release,
  posthog,
}: MobileVendorTelemetryOptions): MobileVendorTelemetryBinding {
  const sentryEnabled = Boolean(sentryDsn)
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      release,
      defaultIntegrations: false,
      sendDefaultPii: false,
    })
  }

  if (!sentryEnabled && !posthog) return { adapter: null, async dispose() {} }

  return {
    adapter: {
      captureException(error, context) {
        if (!sentryEnabled) return
        Sentry.captureException(error, captureContext('mobile', context))
      },
      captureMessage(message, level, context) {
        if (!sentryEnabled) return
        Sentry.captureMessage(message, {
          ...captureContext('mobile', context),
          level: toSentryLevel(level),
        })
      },
      track(eventName, properties) {
        posthog?.capture(eventName, properties)
      },
      identify(userId, traits) {
        posthog?.identify(userId, traits)
      },
      resetIdentity() {
        posthog?.reset()
      },
      setAnalyticsConsent(consent) {
        if (consent === 'granted') posthog?.optIn?.()
        else posthog?.optOut?.()
      },
      getFeatureFlag(definition: FeatureFlagDefinition) {
        if (!posthog || !definition.remoteKey) return undefined
        const value = posthog.getFeatureFlag?.(definition.remoteKey)
        return typeof value === 'boolean' ? value : undefined
      },
    },
    async dispose() {
      if (sentryEnabled) await Sentry.close()
      posthog?.optOut?.()
      posthog?.reset()
    },
  }
}

function sameMobileVendorTelemetryOptions(
  previous: MobileVendorTelemetryOptions | null,
  next: MobileVendorTelemetryOptions,
): boolean {
  return (
    previous?.sentryDsn === next.sentryDsn &&
    previous?.release === next.release &&
    previous?.posthog === next.posthog
  )
}
