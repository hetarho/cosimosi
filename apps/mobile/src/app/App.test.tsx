import { render, screen, waitFor } from '@testing-library/react-native'

import type { LinkingOptions } from '@react-navigation/native'

import { createGetUniverseQueryKey, type GetUniverseResponse } from '@cosimosi/api-client'
import { setClientCacheData } from '@cosimosi/client-cache'
import { m } from '@cosimosi/i18n'

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
