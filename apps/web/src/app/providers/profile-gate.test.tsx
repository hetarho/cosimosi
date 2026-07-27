// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountService } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade, pendingInvite } from '@cosimosi/auth'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'
import { m } from '../../shared/i18n/index.ts'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'

import { WebAuthProvider } from './auth-provider.tsx'
import { PaletteBootstrap } from './palette-bootstrap.tsx'
import { ProfileGate } from './profile-gate.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

describe('ProfileGate', () => {
  const disposers: Array<() => void | Promise<void>> = []

  afterEach(async () => {
    while (disposers.length) await disposers.pop()?.()
  })

  it('releases the palette gate and routed child only for a present profile', async () => {
    const harness = await renderGate('present')

    await vi.waitFor(() => expect(harness.container.textContent).toContain('product-child'))
    expect(harness.paletteReads()).toBe(1)
  })

  it('renders the one-field nickname step and issues no palette/product read for absence', async () => {
    const harness = await renderGate('absent')

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(m.signup_nickname_title()),
    )
    expect(harness.container.querySelectorAll('input')).toHaveLength(1)
    expect(harness.container.textContent).not.toContain('product-child')
    expect(harness.paletteReads()).toBe(0)

    pendingInvite.capture('held-token')
    const input = harness.container.querySelector('input')
    const form = harness.container.querySelector('form')
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    expect(input).not.toBeNull()
    expect(form).not.toBeNull()
    await act(async () => {
      valueSetter?.call(input, 'Nova')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const originalDateTimeFormat = Intl.DateTimeFormat
    Intl.DateTimeFormat = (() => {
      throw new Error('Intl unavailable')
    }) as unknown as typeof Intl.DateTimeFormat
    try {
      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      await vi.waitFor(() => expect(harness.signupRequests).toHaveLength(1))
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat
    }
    expect(harness.signupRequests[0]).toEqual({
      nickname: 'Nova',
      timezone: 'UTC',
      locale: 'en',
      inviteToken: 'held-token',
    })
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(m.signup_nickname_failed()),
    )
  })

  it('renders neutral retry and sign-out controls only for a genuine read refusal', async () => {
    const harness = await renderGate('refused')

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(m.signup_profile_refused()),
    )
    expect(harness.container.textContent).toContain(m.signup_profile_retry())
    expect(harness.container.textContent).toContain(m.signup_profile_sign_out())
    expect(harness.container.textContent).not.toContain(m.signup_nickname_title())
    expect(harness.paletteReads()).toBe(0)
  })

  async function renderGate(profile: 'present' | 'absent' | 'refused') {
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    let paletteReads = 0
    const signupRequests: Array<Record<string, unknown>> = []
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        getProfile() {
          if (profile === 'refused') throw new Error('profile refused')
          if (profile === 'absent') return {}
          return {
            profile: {
              nickname: 'Test user',
              timezone: 'UTC',
              locale: 'en',
              email: 'test@example.test',
              createdAt: '2026-07-26T00:00:00Z',
            },
          }
        },
        getPalettePreference() {
          paletteReads += 1
          return { paletteId: DEFAULT_PALETTE_ID }
        },
        signUp(request) {
          signupRequests.push({
            nickname: request.nickname,
            timezone: request.timezone,
            locale: request.locale,
            inviteToken: request.inviteToken,
          })
          throw new Error('server refused')
        },
      })
    })
    const facade = createAuthFacade({
      adapter: new FakeAuthAdapter({
        initial: { userId: 'profile-user', expiresAt: Date.now() + 60_000 },
      }),
    })
    const observability = createObservabilityFacade()
    const queryClient = createClientCacheQueryClient()
    const container = document.createElement('div')
    const root = createRoot(container)
    await expect.poll(() => facade.snapshot.userId).toBe('profile-user')

    await act(async () => {
      root.render(
        <ObservabilityProvider facade={observability}>
          <WebAuthProvider facade={facade}>
            <WebClientCacheProvider queryClient={queryClient} transport={transport}>
              <ProfileGate>
                <PaletteBootstrap>
                  <span>product-child</span>
                </PaletteBootstrap>
              </ProfileGate>
            </WebClientCacheProvider>
          </WebAuthProvider>
        </ObservabilityProvider>,
      )
    })

    disposers.push(async () => {
      await act(async () => root.unmount())
      pendingInvite.clear()
      queryClient.clear()
      observability.dispose()
      facade.dispose()
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    })
    return { container, paletteReads: () => paletteReads, signupRequests }
  }
})
