// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService, type UpdateProfileRequest } from '@cosimosi/api-client'
import { getActiveLocale, setActiveLocale } from '@cosimosi/i18n'

import { readStoredLocale, writeStoredLocale } from '../../../shared/lib/locale-storage.ts'
import { ErrorToastContext } from '../../../shared/model/index.ts'
import { AccountProfile } from './AccountProfile.tsx'

const storedLocales = new Map<string, string>()

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storedLocales.get(key) ?? null,
      setItem: (key: string, value: string) => storedLocales.set(key, value),
    },
  })
})

afterEach(() => {
  cleanup()
  storedLocales.clear()
  setActiveLocale('en')
})

describe('AccountProfile', () => {
  it('issues one complete update for one confirmed nickname edit', async () => {
    const requests: Array<{ nickname: string; timezone: string; locale: string }> = []
    const harness = renderProfile({
      updateProfile(request) {
        requests.push({
          nickname: request.nickname,
          timezone: request.timezone,
          locale: request.locale,
        })
        return { profile: { ...profile, nickname: request.nickname } }
      },
    })
    const user = userEvent.setup()

    await user.clear(await screen.findByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Nova')
    await user.click(screen.getByRole('button', { name: 'Keep this name' }))

    await waitFor(() =>
      expect(requests).toEqual([{ nickname: 'Nova', timezone: 'UTC', locale: 'en' }]),
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText(/does not refill today's small stardust/)).toBeTruthy()
    harness.queryClient.clear()
  })

  it('applies and stores locale before the write, then rolls both back on refusal', async () => {
    const order: string[] = []
    const showError = vi.fn()
    writeStoredLocale('en')
    renderProfile(
      {
        updateProfile() {
          order.push(`${getActiveLocale()}:${readStoredLocale()}`)
          throw new Error('refused')
        },
      },
      showError,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '한국어' }))

    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['ko:ko'])
    expect(getActiveLocale()).toBe('en')
    expect(readStoredLocale()).toBe('en')
  })
})

const profile = {
  nickname: 'Test user',
  timezone: 'UTC',
  locale: 'en',
  email: 'test@example.test',
  createdAt: '2026-07-26T00:00:00Z',
}

function renderProfile(
  handlers: {
    updateProfile: (request: UpdateProfileRequest) => unknown
  },
  showError = vi.fn(),
) {
  const transport = createRouterTransport(({ service }) => {
    service(AccountService, {
      getProfile: () => ({ profile }),
      updateProfile: (request) => handlers.updateProfile(request) as never,
      getInviteLink: () => ({
        token: 'opaque',
        expiresAt: '2026-08-02T00:00:00Z',
      }),
    })
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <ErrorToastContext.Provider value={showError}>
      <TransportProvider transport={transport}>
        <QueryClientProvider client={queryClient}>
          <AccountProfile />
        </QueryClientProvider>
      </TransportProvider>
    </ErrorToastContext.Provider>,
  )
  return { queryClient }
}
