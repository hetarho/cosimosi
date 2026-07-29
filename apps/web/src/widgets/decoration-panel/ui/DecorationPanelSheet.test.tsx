// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountService, StoreService, TwinkleService } from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import { AuthProvider } from '@cosimosi/auth/react'
import {
  ORNAMENT_KINDS,
  resetStoreUserState,
  useDecorationRequestStore,
  useOrnamentPreviewStore,
} from '@cosimosi/store'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'

import { m } from '../../../shared/i18n/index.ts'
import { DecorationPanelSheet } from './DecorationPanelSheet.tsx'

afterEach(() => {
  cleanup()
  resetStoreUserState()
  useTwinkleBalanceStore.getState().clear()
})

const CATALOG = {
  ornaments: [
    {
      ornamentId: 'background.grainient',
      kind: 1,
      acquisition: 1,
      price: 0n,
      owned: true,
      selected: true,
    },
    {
      ornamentId: 'background.lightfall',
      kind: 1,
      acquisition: 2,
      price: 300n,
      owned: false,
      selected: false,
    },
    {
      ornamentId: 'star_shader.facet',
      kind: 2,
      acquisition: 1,
      price: 0n,
      owned: true,
      selected: true,
    },
  ],
}

function stubAuthFacade(): AuthFacade {
  const snapshot = { status: 'authenticated' as const, userId: 'panel-user', accessToken: 'token' }
  return {
    snapshot,
    subscribe: () => () => {},
    signOut: async () => {},
  } as unknown as AuthFacade
}

function mount() {
  const transport = createRouterTransport(({ service }) => {
    service(StoreService, {
      getCatalog: () => CATALOG,
      getSelection: () => ({ selections: [] }),
      decorate: () => ({ selection: [], spentTwinkle: 0n }),
    })
    service(TwinkleService, {
      getBalance: () => ({ small: 0n, general: 0n, total: 0n }),
    })
    service(AccountService, { getProfile: () => ({}) })
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  return render(
    <AuthProvider facade={stubAuthFacade()}>
      <TransportProvider transport={transport}>
        <QueryClientProvider client={queryClient}>
          <DecorationPanelSheet />
        </QueryClientProvider>
      </TransportProvider>
    </AuthProvider>,
  )
}

describe('decoration panel', () => {
  // Leaving the route unmounts the panel with no CLOSE of its own. The preview must not outlive the
  // surface that installed it — otherwise coming back would show a sky nobody saved.
  it('reverts the preview when it unmounts with a route change', async () => {
    useOrnamentPreviewStore.getState().open()
    useOrnamentPreviewStore.getState().preview('BACKGROUND', 'background.lightfall')
    const view = mount()
    expect(useOrnamentPreviewStore.getState().previewed.BACKGROUND).toBe('background.lightfall')

    view.unmount()

    await waitFor(() => {
      expect(useOrnamentPreviewStore.getState().previewActive).toBe(false)
    })
    for (const kind of ORNAMENT_KINDS) {
      expect(useOrnamentPreviewStore.getState().previewed[kind]).toBe(
        useOrnamentPreviewStore.getState().confirmed[kind],
      )
    }
  })

  // A priced row keeps its price while it is being previewed: "no price means you own it" only holds
  // if the price stays put while the user looks at what it buys.
  it('keeps a previewed row priced', async () => {
    // Opened the way the HUD opens it: through the request store, so the machine and the preview open
    // together.
    useDecorationRequestStore.getState().request()
    mount()
    const row = await screen.findByText(m.store_ornament_background_lightfall())
    await userEvent.click(row)
    await waitFor(() => {
      expect(useOrnamentPreviewStore.getState().previewed.BACKGROUND).toBe('background.lightfall')
    })
    expect(screen.getByText(m.store_price_amount({ amount: 300 }))).toBeTruthy()
  })
})
