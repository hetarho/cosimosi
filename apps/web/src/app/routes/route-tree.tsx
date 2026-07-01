import { createRootRouteWithContext, createRoute, notFound, Outlet } from '@tanstack/react-router'

import { TestPage } from '../../pages/test/index.ts'
import { UniverseHomePage } from '../../pages/universe/index.ts'
import { NotFoundScreen } from './not-found.tsx'

/**
 * Runtime inputs the route tree needs but that the app can't know until it
 * composes. `diagnosticsEnabled` decides whether the /test harness is reachable,
 * resolved from the platform diagnostics flag at mount — the web mirror of the
 * mobile shell's Diagnostics gating.
 */
export interface RouterContext {
  diagnosticsEnabled: boolean
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundScreen,
})

const universeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: UniverseHomePage,
})

const testRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/test',
  // The verification harness (plan 12) is a dev-only surface: unreachable — it
  // resolves to the not-found screen — unless the diagnostics flag is on, so a
  // production build never exposes it.
  beforeLoad: ({ context }) => {
    if (!context.diagnosticsEnabled) throw notFound()
  },
  component: TestPage,
})

export const routeTree = rootRoute.addChildren([universeRoute, testRoute])
