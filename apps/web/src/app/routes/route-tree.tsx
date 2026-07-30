import { createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router'

import { type SessionStatus } from '@cosimosi/auth'

import { DesignShowcasePage } from '../../pages/design/index.ts'
import { parseMeTab, type MeTabId } from '../../pages/me/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { parseDiarySearch, type DiarySearchParams } from './diary-search.ts'
import { authGuardBeforeLoad } from './guards/auth-gate.ts'
import { NotFoundScreen } from './not-found.tsx'
import {
  AdminRoute,
  AuthenticatedLayout,
  BlogNotFoundRoute,
  DiaryReaderRoute,
  InviteRoute,
  DemoRoute,
  LandingRoute,
  LoginRoute,
  MeRoute,
  SignupRoute,
  UniverseRoute,
} from './route-screens.tsx'

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
  notFoundComponent: NotFoundScreen,
})

// The authenticated app subtree (pathless): its guard runs before any product route mounts, so the
// gate is inherited by every route under it (the universe, the archive, and the my page surface
// it lands). The diagnostics /test route sits OUTSIDE it (its own gate); /login, /demo and the
// landing at `/` are public.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context, location }) => authGuardBeforeLoad(context.getSessionStatus, location),
  component: AuthenticatedLayout,
})

// The front door. Under `rootRoute` beside /login and /demo, with no `beforeLoad` of any kind: the
// origin root is a stranger's first contact, so an auth guard here would redirect away the one visitor
// it exists for. `LandingRoute` resolves by gate decision instead, which keeps `/` a single decision
// point rather than a URL that means two things at once. Sitting outside the authenticated layout is
// also what keeps `PaletteBootstrap` and the achievement watcher off it.
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingRoute,
})

// The universe has its own path now that `/` is public. It stays under the authenticated subtree, so
// nothing about its gate changed — only its address.
const universeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/universe',
  component: UniverseRoute,
})

const diaryReaderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/diary',
  // [D7][D8]: the archive's conditions live in the address bar, so a filtered, sorted archive is a
  // shareable link and Back restores the previous conditions.
  validateSearch: (search: Record<string, unknown>): DiarySearchParams => parseDiarySearch(search),
  component: DiaryReaderRoute,
})

const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  validateSearch: (search: Record<string, unknown>): { tab?: MeTabId } => {
    const tab = parseMeTab(search.tab)
    return { tab: search.tab === tab ? tab : undefined }
  },
  component: MeRoute,
})

// The admin console mounts under the authenticated subtree (so it inherits the auth gate); the page
// then applies the admin gate. A web-only operator surface (the admin console) — no mobile route.
const adminRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/admin',
  component: AdminRoute,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: LoginRoute,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupRoute,
})

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: InviteRoute,
})

// The public demo. Under `rootRoute` beside /login and OUTSIDE the authenticated subtree, with no
// `beforeLoad` of any kind: unlike /test and /design it is not diagnostics-gated, and unlike the
// product routes it must not run the auth guard — a signed-out visitor arriving from the landing page
// is its entire audience. Sitting outside the authenticated layout is also what keeps
// `PaletteBootstrap` and the achievement watcher off it.
const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo',
  component: DemoRoute,
})

// The `/blog/**` miss. Public, under `rootRoute` beside /login and /demo, with no `beforeLoad` of any kind:
// a stale link to an essay must not ask anyone to sign in or depend on a diagnostics flag. It can never
// shadow a real post — the Worker's asset handler resolves static files first, so the SPA only executes on
// a genuine miss.
const blogNotFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$',
  component: BlogNotFoundRoute,
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

// The design showcase is the review surface for the 2D language — a dev-only page behind the same
// diagnostics gate as /test, and outside the authenticated subtree because it reads no product data.
const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/design',
  beforeLoad: ({ context }) => {
    if (!context.diagnosticsEnabled) throw notFound()
  },
  component: DesignShowcasePage,
})

export const routeTree = rootRoute.addChildren([
  authenticatedRoute.addChildren([universeRoute, diaryReaderRoute, meRoute, adminRoute]),
  landingRoute,
  loginRoute,
  signupRoute,
  inviteRoute,
  demoRoute,
  blogNotFoundRoute,
  testRoute,
  designRoute,
])
