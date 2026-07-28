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
  DiaryReaderRoute,
  InviteRoute,
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
  loginRoute,
  signupRoute,
  inviteRoute,
  testRoute,
  designRoute,
])
