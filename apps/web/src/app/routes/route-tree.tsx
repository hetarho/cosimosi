import {
  createRootRouteWithContext,
  createRoute,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'

import { type SessionStatus } from '@cosimosi/auth'

import { parseDiarySearch, type DiarySearchParams } from './diary-search.ts'
import { parseMeSearch, type MeSearchParams } from './me-search.ts'
import { authGuardBeforeLoad } from './guards/auth-gate.ts'
import { NotFoundScreen } from './not-found.tsx'
import {
  AuthenticatedLayout,
  BlogNotFoundRoute,
  EntryRoute,
  InviteRoute,
  LandingRoute,
  LoginRoute,
  SignupRoute,
} from './route-screens.tsx'

// The signed-in product, the admin console and the demo sandbox are fetched on demand rather than
// shipped in the entry chunk the front door blocks on. `lazyRouteComponent` (not bare
// `React.lazy`) because the route tree is hand-built and this is the API wired into the router's own
// pending and `.preload()` lifecycle — `router.ts` supplies the one pending state they all share.
//
// The importers point at `screens/*`, one module per screen: rolldown draws a chunk boundary per
// module, so a screen sharing a file with a static one would land back in the entry chunk.
const UniverseScreen = lazyRouteComponent(
  () => import('./screens/universe-route.tsx'),
  'UniverseRoute',
)
const DiaryReaderScreen = lazyRouteComponent(
  () => import('./screens/diary-reader-route.tsx'),
  'DiaryReaderRoute',
)
const MeScreen = lazyRouteComponent(() => import('./screens/me-route.tsx'), 'MeRoute')
const AdminScreen = lazyRouteComponent(() => import('./screens/admin-route.tsx'), 'AdminRoute')
const DemoScreen = lazyRouteComponent(() => import('./screens/demo-route.tsx'), 'DemoRoute')

// The two diagnostics surfaces go the same way, and they need no `screens/` wrapper because the
// router passes them no callbacks. Neither is reachable in a shipped build unless the diagnostics
// flag is on — 176 kB (measured) of harness and component gallery that a stranger at the front door
// can never render. Their `beforeLoad` gate runs before the component loads, so a build with the flag
// off never even fetches the chunk.
const TestScreen = lazyRouteComponent(() => import('../../pages/test/index.ts'), 'TestPage')
const DesignScreen = lazyRouteComponent(
  () => import('../../pages/design/index.ts'),
  'DesignShowcasePage',
)

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
// it lands). The diagnostics /test route sits OUTSIDE it (its own gate); the door at `/`, /login,
// the landing at /about and /demo are public.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context, location }) => authGuardBeforeLoad(context.getSessionStatus, location),
  component: AuthenticatedLayout,
})

// The front door: the origin root is the way IN. No `beforeLoad` of any kind — an auth guard here
// would redirect away the signed-out visitor the route exists for — so `EntryRoute` resolves by gate
// decision instead, which keeps `/` a single decision point rather than a URL that means two things at
// once. Sitting outside the authenticated layout is also what keeps `PaletteBootstrap` and the
// achievement watcher off it.
//
// `/login` still exists and still renders the same screen: it is where the guard sends a deep link,
// carrying `from`, and that return target is the whole reason the two are not one route.
const entryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: EntryRoute,
})

// What the product is, for someone who has not decided yet. Public, under `rootRoute` beside /demo,
// with no `beforeLoad` and no gate decision either: a plain public page, so an authenticated visitor
// who follows a shared link reads it rather than being bounced to their universe. Only the root has a
// session to resolve; this address means one thing to everyone.
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: LandingRoute,
})

// The universe has its own path now that `/` is public. It stays under the authenticated subtree, so
// nothing about its gate changed — only its address.
const universeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/universe',
  component: UniverseScreen,
})

const diaryReaderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/diary',
  // [D7][D8]: the archive's conditions live in the address bar, so a filtered, sorted archive is a
  // shareable link and Back restores the previous conditions.
  validateSearch: (search: Record<string, unknown>): DiarySearchParams => parseDiarySearch(search),
  component: DiaryReaderScreen,
})

const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  validateSearch: (search: Record<string, unknown>): MeSearchParams => parseMeSearch(search),
  component: MeScreen,
})

// The admin console mounts under the authenticated subtree (so it inherits the auth gate); the page
// then applies the admin gate. A web-only operator surface (the admin console) — no mobile route.
const adminRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/admin',
  component: AdminScreen,
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
  component: DemoScreen,
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
  component: TestScreen,
})

// The design showcase is the review surface for the 2D language — a dev-only page behind the same
// diagnostics gate as /test, and outside the authenticated subtree because it reads no product data.
const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/design',
  beforeLoad: ({ context }) => {
    if (!context.diagnosticsEnabled) throw notFound()
  },
  component: DesignScreen,
})

export const routeTree = rootRoute.addChildren([
  authenticatedRoute.addChildren([universeRoute, diaryReaderRoute, meRoute, adminRoute]),
  entryRoute,
  aboutRoute,
  loginRoute,
  signupRoute,
  inviteRoute,
  demoRoute,
  blogNotFoundRoute,
  testRoute,
  designRoute,
])
