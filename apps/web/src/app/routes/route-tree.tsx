import { createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router'

import { type SessionStatus } from '@cosimosi/auth'

import { TestPage } from '../../pages/test/index.ts'
import { authGuardBeforeLoad } from './guards/auth-gate.ts'
import { NotFoundScreen } from './not-found.tsx'
import {
  AdminRoute,
  AuthenticatedLayout,
  DiaryReaderRoute,
  LoginRoute,
  SettingsRoute,
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
  authenticatedRoute.addChildren([universeRoute, diaryReaderRoute, settingsRoute, adminRoute]),
  loginRoute,
  testRoute,
])
