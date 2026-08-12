import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createGetMoodColorsQueryKey,
  createGetProfileQueryKey,
  createGetSelectionQueryKey,
  createGetUniverseQueryKey,
  type GetUniverseResponse,
} from '@cosimosi/api-client'
import type { SessionStatus } from '@cosimosi/auth'
import { resetUserState } from '@cosimosi/auth/user-state'
import { setClientCacheData } from '@cosimosi/client-cache'
import { defaultLocale, setActiveLocale } from '../shared/i18n/index.ts'
import { createObservabilityFacade } from '@cosimosi/observability'

import { createTestHarnessFakes } from '../pages/test/index.ts'
import { resetWebLocaleUserState } from '../shared/lib/locale-storage.ts'
import App from './App.tsx'
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

function seedDefaultColors(fakes: ReturnType<typeof createTestHarnessFakes>, userId: string) {
  resetUserState(userId, { name: 'locale', reset: resetWebLocaleUserState })
  setClientCacheData(fakes.queryClient, createGetProfileQueryKey(fakes.transport), {
    profile: {
      nickname: 'Test user',
      timezone: 'UTC',
      locale: 'en',
      email: 'test@example.test',
      createdAt: '2026-07-26T00:00:00Z',
    },
  } as never)
  setClientCacheData(fakes.queryClient, createGetMoodColorsQueryKey(fakes.transport), {
    colors: [],
  } as never)
  // The boot gate waits on what the universe wears as well as what a feeling looks like, so both reads
  // have to settle before the app renders anything past the loading line.
  setClientCacheData(fakes.queryClient, createGetSelectionQueryKey(fakes.transport), {
    selections: [],
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
  it('shows the door — never the universe — to a settled signed-out visitor at /', async () => {
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
      // The root is the door: a settled signed-out visitor is handed the way in, plus the two side
      // doors that are the whole reason the marketing page is still one click away.
      expect(html).toContain('Welcome back')
      expect(html).toContain('Enter with Google')
      expect(html).toContain('What is cosimosi?')
      expect(html).toContain('Try the universe')
      // Google is the only provider wired, and the screen says so rather than leaving a visitor to
      // discover it by typing into a field that refuses them.
      expect(html).toContain('For now, Google is the only way in.')
      expect(html).toMatch(/type="password"[^>]*disabled=""/)
      // The marketing page is NOT what `/` resolves to any more; it has its own address.
      expect(html).not.toContain('A diary that fills a universe')
    } finally {
      fakes.dispose()
      observability.dispose()
    }
  })

  // A1's second arm: `/` is one URL with one meaning per session state, so an authenticated arrival must
  // not see the door even for a frame. `EntryRoute` commits only on a settled signed-out decision and
  // holds neutrally otherwise, which is also what covers the mid-refresh case — `refreshing` maps to
  // `'hold'`, pinned in gate-decision.test.ts.
  it('renders no sign-in form at / for an authenticated arrival', async () => {
    const fakes = createTestHarnessFakes({ userId: 'landing-forward-user' })
    const observability = createObservabilityFacade()
    await vi.waitFor(() => expect(fakes.authFacade.snapshot.status).toBe('authenticated'))
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
      expect(html).not.toContain('type="password"')
      expect(html).not.toContain('Enter with Google')
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

  // The marketing page has exactly one address. An invented one — `/landing`, the name it never had —
  // is not-found rather than a second way to reach it.
  it('resolves an unmapped path to not-found', async () => {
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

  // `/about` is the landing at its own address, and it carries NO gate of its own: it renders the page
  // for a stranger and for someone who is already signed in alike. The second arm is the one worth
  // pinning — the surface used to be the root, where an authenticated session was forwarded away from
  // it, so a shared link must no longer bounce the person who followed it.
  it.each<SessionStatus>(['signedOut', 'authenticated'])(
    'renders the landing at /about for a %s visitor',
    async (status) => {
      const fakes = createTestHarnessFakes()
      const observability = createObservabilityFacade()
      const router = createAppRouter({
        diagnosticsEnabled: false,
        getSessionStatus: () => status,
        initialEntries: ['/about'],
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
        // The landing's own headline, and the walkthrough that carries the page's argument (its [M5]
        // closing step is pinned by pages/landing's own model tests).
        expect(html).toContain('A diary that fills a universe')
        expect(html).toContain('Step 1 of 6')
        // No credential form: the page offers the way in — the header's quiet sign-in link — but never
        // a password field of its own.
        expect(html).not.toContain('type="password"')
        expect(html).toContain('Sign in')
      } finally {
        fakes.dispose()
        observability.dispose()
      }
    },
  )

  // The two public routes that carry no session at all. `/demo` is the one PUBLIC surface behind a
  // dynamic import, so this is where a guard accidentally inherited by it — or a chunk that fails to
  // resolve for a visitor who has no session to load it with — would show up. Asserted at the match
  // rather than through renderToString because both screens mount a live canvas.
  it.each([
    ['/demo', '/demo'],
    ['/blog/anything', '/blog/$'],
  ])('resolves %s for a signed-out visitor with no redirect', async (entry, routeId) => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'signedOut',
      initialEntries: [entry],
    })
    await router.load()
    expect(router.state.redirect).toBeUndefined()
    expect(router.state.matches.at(-1)?.routeId).toBe(routeId)
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
    seedDefaultColors(fakes, 'me-test-user')
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
      // /me?tab=achievements lands on the LIST, not a placeholder. The panel element belongs to MePage
      // and was there before, so it proves nothing; what proves the real body mounted is the list's own
      // pending surface — server-rendered, the read has not resolved, so the list renders its skeleton.
      // Swapping the body for a stub would fail this.
      expect(html).toContain('animate-pulse')
      expect(html).toContain('height:160px')
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
    seedDefaultColors(fakes, 'universe-test-user')
    setClientCacheData(fakes.queryClient, createGetUniverseQueryKey(fakes.transport), emptyUniverse)
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => fakes.authFacade.snapshot.status,
      // The universe has its own route now that `/` is the public front door.
      initialEntries: ['/universe'],
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
