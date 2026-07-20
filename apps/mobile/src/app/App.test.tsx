import { TextInput } from 'react-native'

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import type { LinkingOptions } from '@react-navigation/native'

import { createGetUniverseQueryKey, type GetUniverseResponse } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID, resetMoodPalette } from '@cosimosi/emotion'
import { setClientCacheData } from '@cosimosi/client-cache'
import { m } from '@cosimosi/i18n'

import { usePalettePreferenceStore } from '../features/change-palette/index.ts'
import { fallbackSafeAreaMetrics } from '../shared/native/index.ts'
import { createMobileShellFakes, type MobileShellFakes } from '../shared/testing/index.ts'
import App from './App.tsx'
import { ROUTES, type RootStackParamList } from './navigation/routes.ts'

// A settled universe read with zero episodic memories — the first-run beginning ([V7]).
const emptyUniverse = {
  $typeName: 'cosimosi.memory.v1.GetUniverseResponse',
  memories: [],
  neurons: [],
  synapses: [],
  universeTime: '',
} as unknown as GetUniverseResponse

function renderShell(
  fakes: MobileShellFakes,
  navigationLinking: LinkingOptions<RootStackParamList> | null = null,
) {
  return render(
    <App
      authFacade={fakes.authFacade}
      observabilityFacade={fakes.observabilityFacade}
      queryClient={fakes.queryClient}
      transport={fakes.transport}
      locale="en"
      safeAreaMetrics={fallbackSafeAreaMetrics}
      navigationLinking={navigationLinking}
    />,
  )
}

describe('mobile auth gate', () => {
  it('lands an authenticated session on the universe with the first-run welcome', async () => {
    const fakes = createMobileShellFakes({ userId: 'gate-test-user', diagnosticsEnabled: true })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    try {
      renderShell(fakes)
      // The universe stack: the quiet archive entry sits outside the canvas error boundary, so it
      // is present whether or not the (host-stubbed) 3D renderer mounts.
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
      // First-run welcome for a zero-memory read ([V7]) — the same widget tree, no separate route.
      expect(screen.getByText(m.universe_first_run_welcome())).toBeTruthy()
    } finally {
      fakes.dispose()
    }
  })

  it('lands a settled signed-out session on the login stack, not the universe', async () => {
    const fakes = createMobileShellFakes({})
    try {
      renderShell(fakes)
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      // The universe never mounts for a signed-out session (its GetUniverse read never issues).
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
    } finally {
      fakes.dispose()
    }
  })

  it('holds the neutral splash while the session bootstraps — never a signed-out flash', async () => {
    const fakes = createMobileShellFakes({ userId: 'gate-test-user' })
    try {
      renderShell(fakes)
      // The fake adapter settles on a microtask, so synchronously after render the session is
      // still bootstrapping: the splash is mounted and neither the login stack nor the universe is.
      expect(screen.getByText(m.common_loading())).toBeTruthy()
      expect(screen.queryByText(m.login_title())).toBeNull()
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
      // Once settled, the gate swaps to the universe stack — the splash was a hold, not a route.
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
    } finally {
      fakes.dispose()
    }
  })

  it('sign-out unmounts the universe and returns to the login stack', async () => {
    const fakes = createMobileShellFakes({ userId: 'gate-test-user' })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    try {
      renderShell(fakes)
      await waitFor(() => expect(screen.getByText(m.diary_reader_title())).toBeTruthy())
      // The [04] facade action settles the session to signedOut; the gate observes the same
      // snapshot and swaps stacks — the universe view unmounts, nothing is deleted server-side.
      await fakes.authFacade.signOut()
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(screen.queryByText(m.diary_reader_title())).toBeNull()
    } finally {
      fakes.dispose()
    }
  })

  it('reaches the dev diagnostics surface by deep link without leaking secrets', async () => {
    const fakes = createMobileShellFakes({ userId: 'gate-test-user', diagnosticsEnabled: true })
    try {
      renderShell(fakes, {
        prefixes: ['cosimosi://'],
        config: {
          screens: {
            [ROUTES.diagnostics]: 'diagnostics',
            [ROUTES.universe]: 'universe',
            [ROUTES.diaryReader]: 'diary',
          },
        },
        getInitialURL: async () => 'cosimosi://diagnostics',
      })
      await waitFor(() => expect(screen.getByText(m.mobile_diagnostics_title())).toBeTruthy())
      // Provider health only — never the access token or product/private data.
      expect(screen.queryByText(/fake-token/)).toBeNull()
    } finally {
      fakes.dispose()
    }
  })

  it('registers no landing/marketing route — login and the universe are the only entries', () => {
    const names = Object.values(ROUTES)
    expect(names).not.toContain('Landing')
    expect(names).toContain('Login')
    expect(names).toContain('Universe')
  })
})

describe('mobile settings screen', () => {
  afterEach(() => {
    usePalettePreferenceStore.getState().setPaletteId(DEFAULT_PALETTE_ID)
    resetMoodPalette()
  })

  async function openSettings(fakes: MobileShellFakes) {
    renderShell(fakes)
    await waitFor(() => expect(screen.getByText(m.settings_title())).toBeTruthy())
    fireEvent.press(screen.getByText(m.settings_title()))
    await waitFor(() => expect(screen.getByText(m.settings_section_account())).toBeTruthy())
  }

  // A1/A3/A6/A11: the universe affordance reaches the registered SettingsScreen; the composition
  // renders the identity from the snapshot, the registry palettes with the stored preference
  // marked, and the reserved staging slot — from the same message keys as web.
  it('opens settings from the universe with the three sections composed', async () => {
    const fakes = createMobileShellFakes({ userId: 'settings-test-user' })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    try {
      await openSettings(fakes)
      expect(screen.getByText('settings-test-user')).toBeTruthy()
      expect(screen.getByText(m.settings_section_palette())).toBeTruthy()
      expect(screen.getByText(m.palette_name_cosimosi_default())).toBeTruthy()
      expect(screen.getByText(m.palette_name_muted_dusk())).toBeTruthy()
      expect(screen.getByText(m.settings_palette_selected())).toBeTruthy()
      expect(screen.getByText(m.settings_staging_notice())).toBeTruthy()
      expect(screen.getByText(m.settings_staging_boundary())).toBeTruthy()
      // A7 structurally: nothing on the page edits anything — no switch/slider/text input exists.
      expect(screen.queryAllByRole('switch')).toHaveLength(0)
      expect(screen.queryAllByRole('adjustable')).toHaveLength(0)
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0)
    } finally {
      fakes.dispose()
    }
  })

  // A3: sign-out sits behind a plain confirm — cancel does nothing, confirm signs out once and
  // the plan-53 gate lands on login (the section itself never navigates).
  it('signs out through the confirm step and returns to login; cancel stays put', async () => {
    const fakes = createMobileShellFakes({ userId: 'settings-test-user' })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    try {
      await openSettings(fakes)
      fireEvent.press(screen.getByText(m.settings_sign_out()))
      await waitFor(() => expect(screen.getByText(m.settings_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getByText(m.common_cancel()))
      await waitFor(() => expect(screen.queryByText(m.settings_sign_out_confirm())).toBeNull())
      expect(screen.getByText(m.settings_section_account())).toBeTruthy()
      expect(fakes.authFacade.snapshot.status).toBe('authenticated')

      fireEvent.press(screen.getByText(m.settings_sign_out()))
      await waitFor(() => expect(screen.getByText(m.settings_sign_out_confirm())).toBeTruthy())
      fireEvent.press(screen.getAllByText(m.settings_sign_out()).at(-1) as never)
      await waitFor(() => expect(screen.getByText(m.login_title())).toBeTruthy())
      expect(fakes.authFacade.snapshot.status).toBe('signedOut')
      expect(screen.queryByText(m.settings_section_account())).toBeNull()
    } finally {
      fakes.dispose()
    }
  })

  // A4: selecting a palette goes through [51]'s set-and-apply — the optimistic flip is immediate,
  // and when the persist is rejected (this harness's transport implements no account service) the
  // store reverts. A bare setMoodPalette call would do neither.
  it('routes a palette selection through set-and-apply (optimistic flip, revert on failure)', async () => {
    const fakes = createMobileShellFakes({ userId: 'settings-test-user' })
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    try {
      await openSettings(fakes)
      fireEvent.press(screen.getByText(m.palette_name_muted_dusk()))
      expect(usePalettePreferenceStore.getState().paletteId).toBe('muted-dusk')
      await waitFor(() =>
        expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID),
      )
    } finally {
      fakes.dispose()
    }
  })
})
