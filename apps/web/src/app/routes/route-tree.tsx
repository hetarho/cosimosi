import { useEffect } from 'react'

import {
  createRootRouteWithContext,
  createRoute,
  notFound,
  Outlet,
  useLocation,
  useSearch,
} from '@tanstack/react-router'

import { gateDecision, type SessionStatus } from '@cosimosi/auth'
import { m } from '@cosimosi/i18n'

import { useSessionSnapshot } from '../../shared/auth/index.ts'
import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { SettingsPage } from '../../pages/settings/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { UniverseHomePage } from '../../pages/universe/index.ts'
import { authGuardBeforeLoad, loginReturnTarget } from './guards/auth-gate.ts'
import { useAppNavigate } from './navigation.ts'
import { NotFoundScreen } from './not-found.tsx'

/**
 * Runtime inputs the route tree needs but that the app can't know until it
 * composes. `diagnosticsEnabled` decides whether the /test harness is reachable;
 * `getSessionStatus` is the live [04] auth-status accessor the `/`-subtree guard
 * reads in `beforeLoad` (never Supabase directly).
 */
export interface RouterContext {
  diagnosticsEnabled: boolean
  getSessionStatus: () => SessionStatus
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundScreen,
})

// The neutral hold shown while the session is bootstrapping/refreshing — no signed-out flash, no
// universe read yet. The default unauthenticated entry is login, the authenticated one the
// universe; there is no landing/marketing route between them (v1, [U3][U4]).
function AuthHold() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
      <p className="text-sm">{m.common_loading()}</p>
    </main>
  )
}

// The authenticated subtree's layout: the `beforeLoad` guard has already redirected a settled
// signed-out arrival to /login, so this decides only what a passing session renders. If the user
// signs out WHILE mounted, the live snapshot flips to a login decision and this navigates to /login
// (the guard only runs on entry). GetUniverse (and any product read below) mounts only through
// <Outlet/>, so it never issues without a session ([U1][A8]). Future product routes (e.g. /settings)
// mount under this same guard.
//
// Only the initial `bootstrapping` hides the universe behind the neutral hold (no read yet). A
// `refreshing` session is provisionally authenticated (its userId is preserved), so the universe
// stays mounted through a token refresh — "hold in place", never a blank or a re-read.
//
// The navigation to /login carries the current location as `from` so a re-sign-in returns here.
// This also covers the common first-load deep link: a direct URL that arrives while the session is
// still bootstrapping passes the (entry-only) guard, then settles to signed-out HERE — carrying
// `from` keeps the return-to-original path the guard's own redirect provides (A7).
function AuthenticatedLayout() {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const location = useLocation()
  const decision = gateDecision(status)
  useEffect(() => {
    if (decision === 'login') {
      navigate({ to: '/login', search: { from: location.pathname } })
    }
  }, [decision, navigate, location.pathname])
  if (status === 'authenticated' || status === 'refreshing') return <Outlet />
  return <AuthHold />
}

// The router seam stays confined to this segment: the universe/reader surfaces navigate between
// each other through callbacks these app-layer route components supply, so no page or widget
// imports the router. Named components (not inline arrows) so the navigation hook obeys the
// rules-of-hooks. The universe stays the home route ('/'); the archive is its own ('/diary').
function UniverseRoute() {
  const navigate = useAppNavigate()
  return (
    <UniverseHomePage
      onOpenReader={() => navigate({ to: '/diary' })}
      onOpenSettings={() => navigate({ to: '/settings' })}
    />
  )
}

function DiaryReaderRoute() {
  const navigate = useAppNavigate()
  return <DiaryReaderPage onExit={() => navigate({ to: '/' })} />
}

function SettingsRoute() {
  const navigate = useAppNavigate()
  return <SettingsPage onExit={() => navigate({ to: '/' })} />
}

// The login entry: on a successful sign-in the session reaches authenticated, so this returns the
// user to the route they were headed for (the guard's `from`, validated) or the universe. An
// already-signed-in visitor to /login is bounced straight to the universe. While the session is
// still settling (bootstrapping/refreshing) this holds neutrally instead of rendering the form —
// the no-flash rule applies to /login too: a signed-in user opening /login cold must not see a
// sign-in form for a beat before being bounced. `signingIn` keeps the form (that is where the
// pending sign-in lives).
function LoginRoute() {
  const search = useSearch({ strict: false }) as { from?: string }
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)
  const authenticated = decision === 'universe'
  useEffect(() => {
    if (authenticated) {
      navigate({ to: loginReturnTarget(search.from) })
    }
  }, [authenticated, search.from, navigate])
  if (decision === 'hold') return <AuthHold />
  return <LoginPage />
}

// The authenticated app subtree (pathless): its guard runs before any product route mounts, so the
// gate is inherited by every route under it (the universe, the archive, and the settings page once
// it lands). The diagnostics /test route sits OUTSIDE it (its own gate), and /login is public.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context, location }) => authGuardBeforeLoad(context.getSessionStatus, location),
  component: AuthenticatedLayout,
})

const universeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: UniverseRoute,
})

const diaryReaderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/diary',
  component: DiaryReaderRoute,
})

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  component: SettingsRoute,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: LoginRoute,
})

const testRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/test',
  // The verification harness is a dev-only surface: unreachable — it
  // resolves to the not-found screen — unless the diagnostics flag is on, so a
  // production build never exposes it.
  beforeLoad: ({ context }) => {
    if (!context.diagnosticsEnabled) throw notFound()
  },
  component: TestPage,
})

export const routeTree = rootRoute.addChildren([
  authenticatedRoute.addChildren([universeRoute, diaryReaderRoute, settingsRoute]),
  loginRoute,
  testRoute,
])
