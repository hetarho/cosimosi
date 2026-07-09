import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { m } from '@cosimosi/i18n'

import { fallbackSafeAreaMetrics } from '../shared/native/index.ts'
import { createMobileShellFakes, type MobileShellFakes } from '../shared/testing/index.ts'
import App from './App.tsx'

function renderShell(fakes: MobileShellFakes) {
  return render(
    <App
      authFacade={fakes.authFacade}
      observabilityFacade={fakes.observabilityFacade}
      queryClient={fakes.queryClient}
      transport={fakes.transport}
      locale="en"
      safeAreaMetrics={fallbackSafeAreaMetrics}
      navigationLinking={null}
    />,
  )
}

describe('mobile app shell', () => {
  it('boots through the provider stack to ShellHome with fake adapters (no emulator)', async () => {
    const fakes = createMobileShellFakes({ userId: 'shell-test-user', diagnosticsEnabled: true })
    try {
      renderShell(fakes)
      await waitFor(() => expect(screen.getByText(m.mobile_shell_home_title())).toBeTruthy())
    } finally {
      fakes.dispose()
    }
  })

  it('opens diagnostics through the typed navigation boundary without leaking secrets', async () => {
    const fakes = createMobileShellFakes({ userId: 'shell-test-user', diagnosticsEnabled: true })
    try {
      renderShell(fakes)
      await waitFor(() => expect(screen.getByText(m.mobile_shell_open_diagnostics())).toBeTruthy())

      fireEvent.press(screen.getByText(m.mobile_shell_open_diagnostics()))
      await waitFor(() => expect(screen.getByText(m.mobile_diagnostics_title())).toBeTruthy())

      // provider health only — never the access token or product/private data.
      expect(screen.queryByText(/fake-token/)).toBeNull()
    } finally {
      fakes.dispose()
    }
  })

  it('hides the diagnostics entry when the platform flag is off', async () => {
    const fakes = createMobileShellFakes({ userId: 'shell-test-user' })
    try {
      renderShell(fakes)
      await waitFor(() => expect(screen.getByText(m.mobile_shell_home_title())).toBeTruthy())

      expect(screen.queryByText(m.mobile_shell_open_diagnostics())).toBeNull()
    } finally {
      fakes.dispose()
    }
  })
})
