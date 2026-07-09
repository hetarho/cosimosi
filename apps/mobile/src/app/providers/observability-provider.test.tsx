import { render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

import * as Sentry from '@sentry/react-native'
import { useObservabilityFacade } from '@cosimosi/observability/react'

import { MobileObservabilityProvider } from './observability-provider.tsx'

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  close: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}))

const DIAGNOSTICS_FLAG_ENV = 'COSIMOSI_FLAG_PLATFORM_DIAGNOSTICSSURFACE'

function DiagnosticsFlagProbe() {
  const observability = useObservabilityFacade()
  return (
    <Text>
      {observability.getFeatureFlag('platform.diagnosticsSurface') ? 'enabled' : 'disabled'}
    </Text>
  )
}

describe('MobileObservabilityProvider', () => {
  let previousFlagValue: string | undefined

  beforeEach(() => {
    previousFlagValue = mobileTestEnv()[DIAGNOSTICS_FLAG_ENV]
    jest.clearAllMocks()
  })

  afterEach(() => {
    const env = mobileTestEnv()
    if (previousFlagValue === undefined) delete env[DIAGNOSTICS_FLAG_ENV]
    else env[DIAGNOSTICS_FLAG_ENV] = previousFlagValue
  })

  it('applies mobile build-time feature flag overrides', () => {
    mobileTestEnv()[DIAGNOSTICS_FLAG_ENV] = 'true'

    render(
      <MobileObservabilityProvider>
        <DiagnosticsFlagProbe />
      </MobileObservabilityProvider>,
    )

    expect(screen.getByText('enabled')).toBeTruthy()
  })

  it('closes the previous Sentry client before reinitializing vendor config', async () => {
    const { rerender } = render(<MobileObservabilityProvider sentryDsn="dsn-1" release="1" />)

    await waitFor(() =>
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'dsn-1' })),
    )

    rerender(<MobileObservabilityProvider sentryDsn="dsn-2" release="2" />)

    await waitFor(() => expect(Sentry.close).toHaveBeenCalledTimes(1))
    expect(Sentry.init).toHaveBeenLastCalledWith(
      expect.objectContaining({ dsn: 'dsn-2', release: '2' }),
    )
  })
})

function mobileTestEnv(): Record<string, string | undefined> {
  const env = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env
  if (!env) throw new Error('process.env is required for the mobile observability provider test')
  return env
}
