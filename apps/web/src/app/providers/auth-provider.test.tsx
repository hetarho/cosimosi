// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { createAuthFacade, FakeAuthAdapter } from '@cosimosi/auth'
import { AuthProvider, useAuthFacade } from '@cosimosi/auth/react'

afterEach(cleanup)

function Consumer() {
  const facade = useAuthFacade()
  return <span>{facade.snapshot.status}</span>
}

describe('owned auth lifecycle', () => {
  it('disposes every committed facade through replay and real remounts', () => {
    const disposers: ReturnType<typeof vi.spyOn>[] = []
    const createFacade = () => {
      const facade = createAuthFacade({ adapter: new FakeAuthAdapter() })
      disposers.push(vi.spyOn(facade, 'dispose'))
      return facade
    }
    for (let i = 0; i < 3; i++) {
      const view = render(
        <StrictMode>
          <AuthProvider createFacade={createFacade}>
            <Consumer />
          </AuthProvider>
        </StrictMode>,
      )
      expect(view.container.textContent).toBeTruthy()
      view.unmount()
    }
    expect(disposers.length).toBeGreaterThanOrEqual(3)
    for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce()
  })

  it('leaves an injected facade owned by its caller', () => {
    const facade = createAuthFacade({ adapter: new FakeAuthAdapter() })
    const dispose = vi.spyOn(facade, 'dispose')
    render(
      <AuthProvider facade={facade}>
        <Consumer />
      </AuthProvider>,
    ).unmount()
    expect(dispose).not.toHaveBeenCalled()
    facade.dispose()
  })
})
