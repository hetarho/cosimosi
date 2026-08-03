import { createMemoryHistory, createRouter } from '@tanstack/react-router'

import type { SessionStatus } from '@cosimosi/auth'

import { routeTree } from './route-tree.tsx'
import { AuthHold } from './route-screens.tsx'

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
    // Pinned rather than left to the default, because the origin now publishes canonical URLs: the
    // shell's <link rel="canonical"> and the root sitemap both use the slashless form, and the client
    // router has to agree with them. The root is the sole exception. `/blog/` is outside this router
    // (the Worker's asset handler serves it), so the blog's own trailing-slash policy cannot conflict.
    trailingSlash: 'never',
    // One pending state for the whole app, not a Suspense boundary hand-placed per route. It is the
    // same neutral hold a settling session shows, so a chunk fetch and a session refresh look
    // identical instead of teaching the app a second loading language. Setting it is also what puts
    // a Suspense boundary at the matched route rather than at the root: TanStack only wraps a match
    // when a pending component exists, so without this a lazily-imported screen would suspend the
    // whole tree to a null fallback — a blank frame, which is exactly what A5 forbids.
    defaultPendingComponent: AuthHold,
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
