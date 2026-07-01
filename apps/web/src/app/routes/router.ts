import { createMemoryHistory, createRouter } from '@tanstack/react-router'

import { routeTree } from './route-tree.tsx'

export interface CreateAppRouterOptions {
  /** Whether the /test harness route is reachable (the platform diagnostics flag). */
  diagnosticsEnabled: boolean
  /**
   * In-memory history entries. Tests/storybook pass these to render at a chosen
   * route without touching `window.location`; production omits them and the router
   * uses browser history. Kept as plain strings so `@tanstack/react-router` never
   * leaks past this segment.
   */
  initialEntries?: readonly string[]
}

export function createAppRouter({ diagnosticsEnabled, initialEntries }: CreateAppRouterOptions) {
  return createRouter({
    routeTree,
    context: { diagnosticsEnabled },
    ...(initialEntries ? { history: createMemoryHistory({ initialEntries: [...initialEntries] }) } : {}),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
