import { describe, expect, it } from 'vitest'

import {
  createInMemoryTelemetryAdapter,
  createObservabilityFacade,
  defineFeatureFlagRegistry,
  platformFeatureFlags,
  safeTelemetryProperties,
  type TelemetryPropertyBag,
} from './index.ts'

describe('observability facade', () => {
  it('captures operational errors without analytics consent', () => {
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({ adapters: [memory] })

    observability.captureException(new Error('boom'), {
      source: 'test',
      properties: { requestId: 'request-1' },
    })

    expect(memory.events).toHaveLength(1)
    expect(memory.events[0]?.kind).toBe('exception')
  })

  it('blocks analytics and identify until consent is granted, then resets on withdrawal', () => {
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({ adapters: [memory] })

    expect(observability.track('app_opened', { surface: 'web' })).toBe(false)
    expect(observability.identify('user-1')).toBe(false)
    expect(memory.events.some((event) => event.kind === 'track')).toBe(false)
    expect(memory.events.some((event) => event.kind === 'identify')).toBe(false)

    observability.setConsent('granted')
    expect(observability.track('app_opened', { surface: 'web' })).toBe(true)
    expect(observability.identify('user-1', { plan: 'plan/10' })).toBe(true)

    observability.setConsent('denied')
    expect(observability.track('app_closed', { surface: 'web' })).toBe(false)
    expect(memory.events.filter((event) => event.kind === 'resetIdentity')).toHaveLength(1)
  })

  it('rejects sensitive telemetry property keys at runtime', () => {
    const observability = createObservabilityFacade()
    const unsafeProperties = { authToken: 'private' } as TelemetryPropertyBag

    expect(() =>
      observability.captureMessage('nope', 'warning', { properties: unsafeProperties }),
    ).toThrow(/Sensitive telemetry property/)
  })

  it('threads the latest request id into frontend error reports', () => {
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({ adapters: [memory] })

    observability.setRequestId('request-frontend-1')
    observability.captureException(new Error('boom'), { source: 'test' })

    const event = memory.events[0]
    expect(event?.kind).toBe('exception')
    if (event?.kind === 'exception') {
      expect(event.context.properties).toMatchObject({ requestId: 'request-frontend-1' })
    }
  })

  it('redacts raw exception messages before operational reporting', () => {
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({ adapters: [memory] })

    observability.captureException(new Error('diary text: private content'), { source: 'test' })

    const event = memory.events[0]
    expect(event?.kind).toBe('exception')
    if (event?.kind === 'exception') {
      expect(event.error).toBeInstanceOf(Error)
      expect((event.error as Error).message).toBe('operational error')
      expect((event.error as Error).message).not.toContain('private content')
      expect(event.context.properties).toMatchObject({ errorName: 'Error' })
    }
  })

  it('uses committed flag defaults, dev overrides, and consent-aware remote values', () => {
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({
      adapters: [memory],
      flagRegistry: platformFeatureFlags,
    })

    expect(observability.getFeatureFlag('platform.diagnosticsSurface')).toBe(false)

    memory.setFeatureFlag('platform.diagnosticsSurface', true)
    expect(observability.getFeatureFlag('platform.diagnosticsSurface')).toBe(true)

    observability.setConsent('granted')
    expect(observability.getFeatureFlag('platform.diagnosticsSurface')).toBe(true)

    const overridden = createObservabilityFacade({
      flagRegistry: platformFeatureFlags.withOverrides({ 'platform.diagnosticsSurface': false }),
      adapters: [memory],
    })
    overridden.setConsent('granted')
    expect(overridden.getFeatureFlag('platform.diagnosticsSurface')).toBe(false)
  })

  it('gates release flags by consent while safety flags can bypass consent', () => {
    const registry = defineFeatureFlagRegistry([
      {
        key: 'platform.remoteKillSwitch',
        defaultValue: false,
        owner: 'plan/10.observability-and-flags',
        kind: 'kill-switch',
        description: 'Safety control.',
        review: 'Can be read before analytics consent.',
        remoteKey: 'platform-remote-kill-switch',
      },
      {
        key: 'platform.releaseToggle',
        defaultValue: false,
        owner: 'plan/10.observability-and-flags',
        kind: 'release',
        description: 'Release rollout.',
        review: 'Consent-gated remote lookup.',
        remoteKey: 'platform-release-toggle',
      },
    ] as const)
    const memory = createInMemoryTelemetryAdapter()
    const observability = createObservabilityFacade({ adapters: [memory], flagRegistry: registry })

    memory.setFeatureFlag('platform.remoteKillSwitch', true)
    memory.setFeatureFlag('platform.releaseToggle', true)

    expect(observability.getFeatureFlag('platform.remoteKillSwitch')).toBe(true)
    expect(observability.getFeatureFlag('platform.releaseToggle')).toBe(false)

    observability.setConsent('granted')
    expect(observability.getFeatureFlag('platform.releaseToggle')).toBe(true)
  })
})

describe('observability types', () => {
  it('keeps sensitive keys and tuning values out of typed surfaces', () => {
    safeTelemetryProperties({ requestId: 'safe' })
    expect(() => {
      // @ts-expect-error auth tokens cannot be telemetry.
      safeTelemetryProperties({ authToken: 'secret' })
    }).toThrow(/Sensitive telemetry property/)

    defineFeatureFlagRegistry([
      {
        key: 'platform.booleanOnly',
        defaultValue: true,
        owner: 'plan/10.observability-and-flags',
        kind: 'operational',
        description: 'Boolean flags only.',
        review: 'Review before enabling.',
      },
    ] as const)

    expect(() =>
      defineFeatureFlagRegistry([
        {
          key: 'platform.a-b',
          defaultValue: false,
          owner: 'plan/10.observability-and-flags',
          kind: 'operational',
          description: 'Collision probe.',
          review: 'Should never compile into one env override.',
        },
        {
          key: 'platform.a_b',
          defaultValue: false,
          owner: 'plan/10.observability-and-flags',
          kind: 'operational',
          description: 'Collision probe.',
          review: 'Should never compile into one env override.',
        },
      ] as const),
    ).toThrow(/PLATFORM_A_B/)

    defineFeatureFlagRegistry([
      {
        key: 'platform.numericTuning',
        // @ts-expect-error numeric product tuning belongs in spec/values.yaml, not feature flags.
        defaultValue: 0.75,
        owner: 'plan/10.observability-and-flags',
        kind: 'operational',
        description: 'Invalid numeric tuning value.',
        review: 'Should never compile.',
      },
    ] as const)
  })
})
