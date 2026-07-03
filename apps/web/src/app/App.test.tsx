import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../pages/test/index.ts'
import App from './App.tsx'
import { createAppRouter } from './routes/index.ts'

// The router resolves its route asynchronously, so SSR tests build a router at the
// target route, `await router.load()`, then inject it — this keeps the existing
// renderToString flow without a DOM. diagnosticsEnabled: true makes /test reachable.
// The query string confirms route matching still ignores search params, the way the
// retired hand-rolled path normalizer did (a real case: OAuth/tracking params on a URL).
async function loadedTestRouter(entry = '/test?probe=1') {
  const router = createAppRouter({ diagnosticsEnabled: true, initialEntries: [entry] })
  await router.load()
  return router
}

describe('web app test harness route', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders /test inside the app provider stack with fake platform helpers', async () => {
    const fakes = createTestHarnessFakes({
      userId: 'test-user',
      ping: () => ({ message: 'pong', requestId: 'app-route-test' }),
    })
    const observability = createObservabilityFacade()
    const router = await loadedTestRouter()

    try {
      const html = renderToString(
        <App
          router={router}
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="en"
        />,
      )

      expect(html).toContain('Test harness')
      expect(html).toContain('Transport ping')
      expect(html).toContain('Design system')
      expect(html).not.toContain('ui-showcase')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('serves the universe as the main page: / composes the universe-canvas widget', async () => {
    const fakes = createTestHarnessFakes({ userId: 'universe-test-user' })
    const observability = createObservabilityFacade()
    const router = await loadedTestRouter('/')

    try {
      // SSR renders the whole DOM-side composition (route registry → page → widget →
      // skin provider → GetUniverse query wiring); the canvas contents mount client-side.
      const html = renderToString(
        <App
          router={router}
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="en"
        />,
      )

      expect(html).toContain('Write a diary')
      expect(html).toContain('Explore')
      expect(html).not.toContain('Nothing orbits here')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('gates /test behind the diagnostics flag — off resolves to not-found', async () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = createAppRouter({ diagnosticsEnabled: false, initialEntries: ['/test'] })
    await router.load()

    try {
      const html = renderToString(
        <App
          router={router}
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="en"
        />,
      )

      expect(html).toContain('Nothing orbits here')
      expect(html).not.toContain('Test harness')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('does not mutate the active locale during server rendering', async () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = await loadedTestRouter()

    try {
      const html = renderToString(
        <App
          router={router}
          authFacade={fakes.authFacade}
          queryClient={fakes.queryClient}
          transport={fakes.transport}
          observabilityFacade={observability}
          locale="ko"
        />,
      )

      expect(html).toContain('Test harness')
      expect(html).not.toContain('테스트 하네스')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })
})
