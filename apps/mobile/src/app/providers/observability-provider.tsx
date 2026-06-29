import {useEffect, useRef, useState, type ReactNode} from 'react';

import * as Sentry from '@sentry/react-native';

import {
  createInMemoryTelemetryAdapter,
  createObservabilityFacade,
  platformFeatureFlags,
  type FeatureFlagDefinition,
  type ObservabilityFacade,
  type TelemetryAdapter,
  type TelemetryContext,
  type TelemetryLevel,
  type TelemetryPropertyBag,
} from '@cosimosi/observability';
import {ObservabilityProvider, useObservabilityFacade, useObservabilitySnapshot} from '@cosimosi/observability/react';

import {useSessionSnapshot} from './auth-provider.tsx';

interface MobileObservabilityProviderProps {
  children?: ReactNode;
  facade?: ObservabilityFacade;
  sentryDsn?: string;
  release?: string;
  posthog?: MobilePostHogClient;
}

interface MobilePostHogClient {
  capture(eventName: string, properties: TelemetryPropertyBag): void;
  identify(userId: string, traits?: TelemetryPropertyBag): void;
  reset(): void;
  optIn?(): void;
  optOut?(): void;
  getFeatureFlag?(key: string): boolean | string | undefined | null;
}

export function MobileObservabilityProvider({
  children,
  facade,
  sentryDsn,
  release,
  posthog,
}: MobileObservabilityProviderProps) {
  const [runtime] = useState(createDefaultMobileObservabilityRuntime);
  const vendorConfig = useRef<MobileVendorTelemetryOptions | null>(null);

  useEffect(() => {
    if (facade) return;
    const nextConfig = {sentryDsn, release, posthog};
    if (sameMobileVendorTelemetryOptions(vendorConfig.current, nextConfig)) return;
    runtime.setVendorAdapter(createMobileVendorTelemetryAdapter(nextConfig));
    vendorConfig.current = nextConfig;
  }, [facade, posthog, release, runtime, sentryDsn]);

  return <ObservabilityProvider facade={facade ?? runtime.facade}>{children}</ObservabilityProvider>;
}

export function MobileObservabilitySessionBridge() {
  const observability = useObservabilityFacade();
  const observabilitySnapshot = useObservabilitySnapshot();
  const session = useSessionSnapshot();

  useEffect(() => {
    if (session.userId) {
      observability.identify(session.userId, {surface: 'mobile'});
    } else {
      observability.resetIdentity();
    }
  }, [observability, observabilitySnapshot.consent, session.userId]);

  return null;
}

interface MobileVendorTelemetryOptions {
  sentryDsn?: string;
  release?: string;
  posthog?: MobilePostHogClient;
}

interface MobileObservabilityRuntime {
  readonly facade: ObservabilityFacade;
  setVendorAdapter(adapter: TelemetryAdapter | null): void;
}

function createDefaultMobileObservabilityRuntime(): MobileObservabilityRuntime {
  const memoryAdapter = createInMemoryTelemetryAdapter();
  let vendorAdapter: TelemetryAdapter | null = null;
  const delegatedVendorAdapter = createDelegatedTelemetryAdapter(() => vendorAdapter);
  const facade = createObservabilityFacade({
    adapters: [memoryAdapter, delegatedVendorAdapter],
    flagRegistry: platformFeatureFlags,
  });
  return {
    facade,
    setVendorAdapter(adapter) {
      vendorAdapter = adapter;
      adapter?.setAnalyticsConsent?.(facade.snapshot.consent);
    },
  };
}

function createMobileVendorTelemetryAdapter({
  sentryDsn,
  release,
  posthog,
}: MobileVendorTelemetryOptions): TelemetryAdapter | null {
  const sentryEnabled = Boolean(sentryDsn);
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      release,
      defaultIntegrations: false,
      sendDefaultPii: false,
    });
  }

  if (!sentryEnabled && !posthog) return null;

  return {
    captureException(error, context) {
      if (!sentryEnabled) return;
      Sentry.captureException(error, captureContext(context));
    },
    captureMessage(message, level, context) {
      if (!sentryEnabled) return;
      Sentry.captureMessage(message, {...captureContext(context), level: toSentryLevel(level)});
    },
    track(eventName, properties) {
      posthog?.capture(eventName, properties);
    },
    identify(userId, traits) {
      posthog?.identify(userId, traits);
    },
    resetIdentity() {
      posthog?.reset();
    },
    setAnalyticsConsent(consent) {
      if (consent === 'granted') posthog?.optIn?.();
      else posthog?.optOut?.();
    },
    getFeatureFlag(definition: FeatureFlagDefinition) {
      if (!posthog || !definition.remoteKey) return undefined;
      const value = posthog.getFeatureFlag?.(definition.remoteKey);
      return typeof value === 'boolean' ? value : undefined;
    },
  };
}

function createDelegatedTelemetryAdapter(getAdapter: () => TelemetryAdapter | null): TelemetryAdapter {
  return {
    captureException(error, context) {
      getAdapter()?.captureException(error, context);
    },
    captureMessage(message, level, context) {
      getAdapter()?.captureMessage(message, level, context);
    },
    track(eventName, properties) {
      getAdapter()?.track(eventName, properties);
    },
    identify(userId, traits) {
      getAdapter()?.identify(userId, traits);
    },
    resetIdentity() {
      getAdapter()?.resetIdentity();
    },
    setAnalyticsConsent(consent) {
      getAdapter()?.setAnalyticsConsent?.(consent);
    },
    getFeatureFlag(definition) {
      return getAdapter()?.getFeatureFlag?.(definition);
    },
  };
}

function sameMobileVendorTelemetryOptions(
  previous: MobileVendorTelemetryOptions | null,
  next: MobileVendorTelemetryOptions,
): boolean {
  return previous?.sentryDsn === next.sentryDsn && previous?.release === next.release && previous?.posthog === next.posthog;
}

function captureContext(context: TelemetryContext) {
  return {
    tags: {
      source: context.source ?? 'mobile',
      request_id: stringProperty(context.properties, 'requestId'),
    },
    extra: context.properties,
  };
}

function stringProperty(properties: TelemetryPropertyBag | undefined, key: string): string | undefined {
  const value = properties?.[key];
  return typeof value === 'string' ? value : undefined;
}

function toSentryLevel(level: TelemetryLevel) {
  return level === 'warning' ? 'warning' : level;
}
