// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountService } from '@cosimosi/api-client'
import { FakeAuthAdapter, createAuthFacade } from '@cosimosi/auth'
import { createClientCacheQueryClient } from '@cosimosi/client-cache'
import {
  DEFAULT_PALETTE_ID,
  defaultMoodPalette,
  moodColor,
  PALETTES,
  resetMoodPalette,
} from '@cosimosi/emotion'
import { createObservabilityFacade } from '@cosimosi/observability'
import { ObservabilityProvider } from '@cosimosi/observability/react'

import {
  changePalette,
  resetPaletteSession,
  usePalettePreferenceStore,
  usePaletteVersion,
} from '../../features/change-palette/index.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { PaletteBootstrap } from './palette-bootstrap.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

describe('PaletteBootstrap', () => {
  afterEach(() => {
    resetMoodPalette()
    usePalettePreferenceStore.getState().reset()
  })

  it('withholds palette-dependent children until their first commit has the stored palette', async () => {
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    let releasePreference = () => {}
    const preferenceBlocked = new Promise<void>((resolve) => {
      releasePreference = resolve
    })
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        async getPalettePreference() {
          await preferenceBlocked
          return { paletteId: 'muted-dusk' }
        },
        setPalettePreference(request) {
          return { paletteId: request.paletteId }
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
    const committedColors: string[] = []
    await expect.poll(() => facade.snapshot.userId).toBe('palette-user')
    resetPaletteSession('palette-user')

    function PaletteProbe() {
      usePaletteVersion()
      const color = moodColor('JOY')
      committedColors.push(color)
      return <span>{color}</span>
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

      releasePreference()
      await vi.waitFor(() => expect(container.textContent).toBe(PALETTES['muted-dusk'].colors.JOY))

      expect(committedColors[0]).toBe(PALETTES['muted-dusk'].colors.JOY)

      await act(() => changePalette(transport, DEFAULT_PALETTE_ID, 'palette-user'))
      expect(container.textContent).toBe(defaultMoodPalette.colors.JOY)
      expect(usePalettePreferenceStore.getState()).toMatchObject({
        paletteId: DEFAULT_PALETTE_ID,
        confirmedPaletteId: DEFAULT_PALETTE_ID,
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
