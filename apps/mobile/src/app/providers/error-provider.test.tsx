import { Pressable, Text } from 'react-native'

import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Code, ConnectError } from '@connectrpc/connect'

import { ErrorInfoSchema } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { ERROR_REASONS } from '@cosimosi/errors'
import { m, setActiveLocale } from '@cosimosi/i18n'

import { useErrorToast } from '../../shared/model/index.ts'
import { MobileErrorProvider } from './error-provider.tsx'

describe('MobileErrorProvider', () => {
  beforeEach(() => {
    setActiveLocale('en')
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the same reason copy without correlation-id noise and uses generated duration', () => {
    render(
      <MobileErrorProvider>
        <Trigger
          error={errorWithDetail(Code.ResourceExhausted, {
            reason: ERROR_REASONS.twinkleInsufficient,
            domain: 'twinkle',
            requestId: 'request-domain',
          })}
        />
      </MobileErrorProvider>,
    )

    fireEvent.press(screen.getByText('trigger'))
    expect(screen.getByText(m.error_twinkle_insufficient())).toBeTruthy()
    expect(screen.queryByText('request-domain')).toBeNull()

    act(() => jest.advanceTimersByTime(VALUES.errors.toastAutoDismissMs - 1))
    expect(screen.getByText(m.error_twinkle_insufficient())).toBeTruthy()
    act(() => jest.advanceTimersByTime(1))
    expect(screen.queryByText(m.error_twinkle_insufficient())).toBeNull()
  })

  it('renders the internal correlation id but never debug detail', () => {
    render(
      <MobileErrorProvider>
        <Trigger
          error={errorWithDetail(Code.Internal, {
            reason: ERROR_REASONS.internal,
            domain: 'platform',
            requestId: 'request-mobile-internal',
            debugDetail: 'database exploded',
          })}
        />
      </MobileErrorProvider>,
    )

    fireEvent.press(screen.getByText('trigger'))
    expect(screen.getByText(/request-mobile-internal/)).toBeTruthy()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})

function Trigger({ error }: { error: unknown }) {
  const showError = useErrorToast()
  return (
    <Pressable onPress={() => showError(error)}>
      <Text>trigger</Text>
    </Pressable>
  )
}

function errorWithDetail(
  code: Code,
  detail: {
    reason: string
    domain: string
    requestId: string
    debugDetail?: string
  },
) {
  return new ConnectError('safe message', code, undefined, [
    { desc: ErrorInfoSchema, value: detail },
  ])
}
