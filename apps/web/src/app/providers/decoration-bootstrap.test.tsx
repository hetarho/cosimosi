// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountService } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade } from '@cosimosi/auth'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { defaultMoodPalette, moodColor, resetMoodPalette } from '@cosimosi/emotion'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'

import { usePaletteVersion } from '../../features/change-mood-colors/index.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { DecorationBootstrap } from './decoration-bootstrap.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'
import { WebToastProvider } from './toast-provider.tsx'

describe('DecorationBootstrap', () => {
  afterEach(() => {
    resetMoodPalette()
  })

  it('withholds children until stored mood rows overlay the authored default', async () => {
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    let releaseColors = () => {}
    const colorsBlocked = new Promise<void>((resolve) => {
      releaseColors = resolve
    })
    // A stored JOY that differs from the authored default, so releasing children before the
    // overlay is applied would be visible as the default color in the first commit.
    const storedJoy = '#4eb9ad'
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        async getMoodColors() {
          await colorsBlocked
          return { colors: [{ mood: 'JOY', color: storedJoy }] }
        },
      })
    })
    const facade = createAuthFacade({
      adapter: new FakeAuthAdapter({
        initial: { userId: 'palette-user', expiresAt: Date.now() + 60_000 },
      }),
    })
    const observability = createObservabilityFacade()
    const queryClient = createClientCacheQueryClient()
    const container = document.createElement('div')
    const root = createRoot(container)
    const committedColors: Array<{ joy: string; calm: string }> = []
    await expect.poll(() => facade.snapshot.userId).toBe('palette-user')
    function PaletteProbe() {
      usePaletteVersion()
      const colors = { joy: moodColor('JOY'), calm: moodColor('CALM') }
      committedColors.push(colors)
      return <span>{`${colors.joy}|${colors.calm}`}</span>
    }

    try {
      await act(async () => {
        root.render(
          <ObservabilityProvider facade={observability}>
            {/* The cache provider drops session-scoped toasts on a scope change, so the queue has to
                be above it here exactly as it is in App.tsx. */}
            <WebToastProvider>
              <WebAuthProvider facade={facade}>
                <WebClientCacheProvider queryClient={queryClient} transport={transport}>
                  <DecorationBootstrap>
                    <PaletteProbe />
                  </DecorationBootstrap>
                </WebClientCacheProvider>
              </WebAuthProvider>
            </WebToastProvider>
          </ObservabilityProvider>,
        )
      })
      expect(committedColors).toEqual([])

      releaseColors()
      await vi.waitFor(() =>
        expect(container.textContent).toBe(`${storedJoy}|${defaultMoodPalette.colors.CALM}`),
      )

      expect(committedColors[0]).toEqual({
        joy: storedJoy,
        calm: defaultMoodPalette.colors.CALM,
      })
    } finally {
      await act(async () => root.unmount())
      queryClient.clear()
      observability.dispose()
      facade.dispose()
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    }
  })
})
