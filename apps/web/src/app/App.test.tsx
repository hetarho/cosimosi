import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createGetPalettePreferenceQueryKey,
  createGetProfileQueryKey,
  createGetUniverseQueryKey,
  type GetUniverseResponse,
} from '@cosimosi/api-client'
import type { SessionStatus } from '@cosimosi/auth'
import { setClientCacheData } from '@cosimosi/client-cache'
import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../pages/test/index.ts'
import App from './App.tsx'
import { resetWebUserState } from './model/reset-user-state.ts'
import { createAppRouter } from './routes/index.ts'

// The router resolves its route asynchronously, so SSR tests build a router at the
// target route, `await router.load()`, then inject it — this keeps the existing
// renderToString flow without a DOM. diagnosticsEnabled: true makes /test reachable.
// The query string confirms route matching still ignores search params, the way the
// retired hand-rolled path normalizer did (a real case: OAuth/tracking params on a URL).
// `status` feeds the `/` auth guard; /test sits outside it so the value is immaterial there.
async function loadedTestRouter(entry = '/test?probe=1', status: SessionStatus = 'authenticated') {
  const router = createAppRouter({
    diagnosticsEnabled: true,
    getSessionStatus: () => status,
    initialEntries: [entry],
  })
  await router.load()
  return router
}

// A settled universe read with zero episodic memories — the first-run beginning ([V7]).
const emptyUniverse = {
  $typeName: 'cosimosi.memory.v1.GetUniverseResponse',
  memories: [],
  neurons: [],
  synapses: [],
  universeTime: '',
} as unknown as GetUniverseResponse

function seedDefaultPalette(fakes: ReturnType<typeof createTestHarnessFakes>, userId: string) {
  resetWebUserState(userId)
  setClientCacheData(fakes.queryClient, createGetProfileQueryKey(fakes.transport), {
    profile: {
      nickname: 'Test user',
      timezone: 'UTC',
      locale: 'en',
      email: 'test@example.test',
      createdAt: '2026-07-26T00:00:00Z',
    },
  } as never)
  setClientCacheData(fakes.queryClient, createGetPalettePreferenceQueryKey(fakes.transport), {
    paletteId: DEFAULT_PALETTE_ID,
  } as never)
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
      expect(html).toContain('Universe + chrome')
      expect(html).not.toContain('ui-showcase')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('gates /test behind the diagnostics flag — off resolves to not-found', async () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'authenticated',
      initialEntries: ['/test'],
    })
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

describe('web auth gate', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  // A8: a settled signed-out visitor to the product `/` never sees the universe — the guard's
  // beforeLoad redirect keeps the universe route (and its GetUniverse read) from mounting. The
  // guard's redirect + from-carry decision table is pinned in guards/auth-gate.test.ts; this is the
  // end-to-end complement: the write action / universe HUD is absent for a signed-out session.
  it('never mounts the universe for a settled signed-out visitor to /', async () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'signedOut',
      initialEntries: ['/'],
    })
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
      expect(html).not.toContain('Write a diary')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  // A7: a directly-entered product URL while signed out resolves to a /login redirect CARRYING the
  // original pathname as `from` — through the real route tree (guard + login route registration),
  // so a successful sign-in can return to the requested route. `router.load()` parks the thrown
  // redirect on state (the SSR 302 seam) rather than committing the location. The return
  // navigation itself is a live effect (LoginRoute) outside the SSR harness's reach; its target
  // selection is `from ?? '/'`.
  it('redirects an unauthenticated deep link to /login carrying the requested route', async () => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'signedOut',
      initialEntries: ['/diary'],
    })
    await router.load()
    expect(router.state.redirect).toMatchObject({
      options: { to: '/login', search: { from: '/diary' } },
    })
  })

  // A3: no landing/marketing route between login and the universe — an invented path is not-found.
  it('has no landing route — an unmapped path resolves to not-found', async () => {
    const fakes = createTestHarnessFakes()
    const observability = createObservabilityFacade()
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'signedOut',
      initialEntries: ['/landing'],
    })
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
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  // My page stays under the same authenticated layout — a signed-out
  // arrival is redirected by the shared guard (the page implements no redirect of its own).
  it('redirects a signed-out /me arrival to /login through the shared gate', async () => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'signedOut',
      initialEntries: ['/me'],
    })
    await router.load()
    expect(router.state.redirect).toMatchObject({
      options: { to: '/login', search: { from: '/me' } },
    })
  })

  it('serves the deep-linked achievements tab with all five tab ids and no decoration', async () => {
    const fakes = createTestHarnessFakes({ userId: 'me-test-user' })
    const observability = createObservabilityFacade()
    await vi.waitFor(() => expect(fakes.authFacade.snapshot.status).toBe('authenticated'))
    seedDefaultPalette(fakes, 'me-test-user')
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => fakes.authFacade.snapshot.status,
      initialEntries: ['/me?tab=achievements'],
    })
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

      expect(html).toContain('You')
      expect(html).toContain('Profile')
      expect(html).toContain('Achievements')
      expect(html).toContain('Diary management')
      expect(html).toContain('Account')
      expect(html).toContain('This record is not available yet.')
      expect(html).not.toContain('Palette')
      expect(html).not.toContain('Camera mood')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  it('does not register the retired settings route', async () => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'authenticated',
      initialEntries: [['', 'settings'].join('/')],
    })
    await router.load()
    expect(router.state.matches.at(-1)?.routeId).toBe('__root__')
  })

  // A4/A6: an authenticated session renders the universe as the main page (`/`), and a zero-memory
  // read renders the SAME universe-canvas composition with the first-run welcome + 일기 쓰기 entry —
  // the empty universe is a beginning, not an error. Drives the facade to authenticated first, since
  // the layout mounts the universe only under an authenticated (or refreshing) live snapshot.
  it('serves the universe with the first-run welcome for an authenticated, empty read', async () => {
    const fakes = createTestHarnessFakes({ userId: 'universe-test-user' })
    const observability = createObservabilityFacade()
    await vi.waitFor(() => expect(fakes.authFacade.snapshot.status).toBe('authenticated'))
    seedDefaultPalette(fakes, 'universe-test-user')
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => fakes.authFacade.snapshot.status,
      initialEntries: ['/'],
    })
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

      expect(html).toContain('Write a diary')
      expect(html).toContain('Write your first diary')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })
})
