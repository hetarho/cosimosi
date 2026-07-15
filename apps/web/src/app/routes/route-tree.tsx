import { createRootRouteWithContext, createRoute, notFound, Outlet } from '@tanstack/react-router'

import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { UniverseHomePage } from '../../pages/universe/index.ts'
import { useAppNavigate } from './navigation.ts'
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

// The router seam stays confined to this segment: the universe/reader surfaces navigate between
// each other through callbacks these app-layer route components supply, so no page or widget
// imports the router. Named components (not inline arrows) so the navigation hook obeys the
// rules-of-hooks. The universe stays the home route ('/'); the archive is its own ('/diary').
function UniverseRoute() {
  const navigate = useAppNavigate()
  return <UniverseHomePage onOpenReader={() => navigate({ to: '/diary' })} />
}

function DiaryReaderRoute() {
  const navigate = useAppNavigate()
  return <DiaryReaderPage onExit={() => navigate({ to: '/' })} />
}

const universeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: UniverseRoute,
})

const diaryReaderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diary',
  component: DiaryReaderRoute,
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

export const routeTree = rootRoute.addChildren([universeRoute, diaryReaderRoute, testRoute])
