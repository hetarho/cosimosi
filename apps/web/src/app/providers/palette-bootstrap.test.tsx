// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountService } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade } from '@cosimosi/auth'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import { moodColor, PALETTES, resetMoodPalette } from '@cosimosi/emotion'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'

import { usePaletteVersion } from '../../features/change-palette/index.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { PaletteBootstrap } from './palette-bootstrap.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

describe('PaletteBootstrap', () => {
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
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        getPalettePreference() {
          return { paletteId: 'muted-dusk' }
        },
        async getMoodColors() {
          await colorsBlocked
          return {
            colors: [{ mood: 'JOY', color: PALETTES['cosimosi-default'].colors.JOY }],
          }
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
            <WebAuthProvider facade={facade}>
              <WebClientCacheProvider queryClient={queryClient} transport={transport}>
                <PaletteBootstrap>
                  <PaletteProbe />
                </PaletteBootstrap>
              </WebClientCacheProvider>
            </WebAuthProvider>
          </ObservabilityProvider>,
        )
      })
      expect(committedColors).toEqual([])

      releaseColors()
      await vi.waitFor(() =>
        expect(container.textContent).toBe(
          `${PALETTES['cosimosi-default'].colors.JOY}|${PALETTES['cosimosi-default'].colors.CALM}`,
        ),
      )

      expect(committedColors[0]).toEqual({
        joy: PALETTES['cosimosi-default'].colors.JOY,
        calm: PALETTES['cosimosi-default'].colors.CALM,
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
