import { createMemoryHistory, createRouter } from '@tanstack/react-router'

import type { SessionStatus } from '@cosimosi/auth'

import { routeTree } from './route-tree.tsx'

export interface CreateAppRouterOptions {
  /** Whether the /test harness route is reachable (the platform diagnostics flag). */
  diagnosticsEnabled: boolean
  /**
   * Reads the CURRENT auth session status at the moment a route's `beforeLoad` runs. A live
   * getter (not a captured value) so the `/` auth guard sees the settled status — the router is
   * built once, but the session settles asynchronously. Sourced from the [04] facade in the
   * provider; the guard never touches Supabase or the session machine directly.
   */
  getSessionStatus: () => SessionStatus
  /**
   * In-memory history entries. Tests/storybook pass these to render at a chosen
   * route without touching `window.location`; production omits them and the router
   * uses browser history. Kept as plain strings so `@tanstack/react-router` never
   * leaks past this segment.
   */
  initialEntries?: readonly string[]
}

export function createAppRouter({
  diagnosticsEnabled,
  getSessionStatus,
  initialEntries,
}: CreateAppRouterOptions) {
  return createRouter({
    routeTree,
    context: { diagnosticsEnabled, getSessionStatus },
    ...(initialEntries
      ? { history: createMemoryHistory({ initialEntries: [...initialEntries] }) }
      : {}),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
