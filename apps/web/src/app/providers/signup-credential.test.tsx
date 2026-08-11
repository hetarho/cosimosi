// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { FakeAuthAdapter, createAuthFacade, type AuthAdapter } from '@cosimosi/auth'
import { ObservabilityProvider } from '@cosimosi/observability/react'
import { m } from '../../shared/i18n/index.ts'

import { LoginPage } from '../../pages/login/index.ts'
import { WebAuthProvider } from './auth-provider.tsx'

describe('LoginPage signup credential state', () => {
  it('shows confirmationSent while the shared session settles signedOut', async () => {
    const base = new FakeAuthAdapter()
    const adapter: AuthAdapter = {
      bootstrap: () => base.bootstrap(),
      signIn: (credentials) => base.signIn(credentials),
      signUpWithPassword: async () => null,
      signInWithGoogle: () => base.signInWithGoogle(),
      completeOAuthSignIn: (callbackUrl) => base.completeOAuthSignIn(callbackUrl),
      signOut: () => base.signOut(),
      refresh: () => base.refresh(),
      getAccessToken: () => base.getAccessToken(),
      onChange: (listener) => base.onChange(listener),
    }
    const facade = createAuthFacade({ adapter })
    const container = document.createElement('div')
    const root = createRoot(container)
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

    try {
      await act(async () => {
        // The entry screen stands on the empty sky, whose renderer is wrapped in an observed error
        // boundary — so the page needs the same observability the app mounts it under. The boundary is
        // what this supplies; the canvas beneath it has no GPU here and falls back to its poster.
        root.render(
          <ObservabilityProvider>
            <WebAuthProvider facade={facade}>
              <LoginPage mode="signUp" />
            </WebAuthProvider>
          </ObservabilityProvider>,
        )
      })
      const inputs = [...container.querySelectorAll('input')]
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      await act(async () => {
        valueSetter?.call(inputs[0], 'new@example.test')
        inputs[0]?.dispatchEvent(new Event('input', { bubbles: true }))
        valueSetter?.call(inputs[1], 'server-owned-password-rule')
        inputs[1]?.dispatchEvent(new Event('input', { bubbles: true }))
        container
          .querySelector('form')
          ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })

      await vi.waitFor(() => expect(container.textContent).toContain(m.signup_confirmation_sent()))
      expect(facade.snapshot.status).toBe('signedOut')
      expect(facade.snapshot.error).toBeNull()
    } finally {
      await act(async () => root.unmount())
      facade.dispose()
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    }
  })
})
