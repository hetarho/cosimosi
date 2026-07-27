// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pendingInvite } from '@cosimosi/auth'
import { m } from '../../shared/i18n/index.ts'
import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../../pages/test/index.ts'
import App from '../App.tsx'
import { createAppRouter } from './index.ts'

describe('web invite entry route', () => {
  afterEach(() => {
    pendingInvite.clear()
    window.sessionStorage.clear()
  })

  it('captures the opaque token and replaces history with the signup surface', async () => {
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => fakes.authFacade.snapshot.status,
      initialEntries: ['/invite/opaque-token'],
    })
    await router.load()
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <App
            router={router}
            authFacade={fakes.authFacade}
            queryClient={fakes.queryClient}
            transport={fakes.transport}
            observabilityFacade={observability}
            locale="en"
          />,
        )
      })

      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/signup'))
      expect(pendingInvite.peek()).toBe('opaque-token')
      expect(container.textContent).toContain(m.signup_title())
      expect(container.textContent).toContain(m.invite_acknowledgment())

      router.history.back()
      await Promise.resolve()
      expect(router.state.location.pathname).toBe('/signup')
    } finally {
      await act(async () => root.unmount())
      fakes.dispose()
      observability.dispose()
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    }
  })
})
