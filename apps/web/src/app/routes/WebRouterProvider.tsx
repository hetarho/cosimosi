import { useCallback, useMemo } from 'react'

import { RouterProvider } from '@tanstack/react-router'

import { useObservabilityFacade } from '@cosimosi/observability/react'

import { diagnosticsSurfaceFlag } from '../../shared/config/index.ts'
import { useAuthFacade } from '../../shared/auth/index.ts'
import { createAppRouter } from './router.ts'

type AppRouter = ReturnType<typeof createAppRouter>

interface WebRouterProviderProps {
  /**
   * A preconfigured router. SSR tests build one, `await router.load()`, then
   * inject it so `renderToString` sees the resolved route. When omitted, the
   * router is built here and the /test route is gated for the current build.
   */
  router?: AppRouter
  /** Render at these routes via in-memory history (client/storybook use). */
  initialEntries?: readonly string[]
}

export function WebRouterProvider({ router, initialEntries }: WebRouterProviderProps) {
  const observability = useObservabilityFacade()
  const facade = useAuthFacade()
  // The /test harness is always reachable in development; a production build
  // exposes it only when the diagnostics flag is explicitly on. `import.meta.env.DEV`
  // is true under the Vite dev server and false in a production build.
  const diagnosticsEnabled =
    import.meta.env.DEV || (observability.getFeatureFlag(diagnosticsSurfaceFlag) ?? false)
  // A live getter over the singleton facade's snapshot, so the `/` guard's beforeLoad reads the
  // CURRENT auth status each time it runs (the router is built once; the session settles later).
  const getSessionStatus = useCallback(() => facade.snapshot.status, [facade])
  const resolved = useMemo(
    () => router ?? createAppRouter({ diagnosticsEnabled, getSessionStatus, initialEntries }),
    [router, initialEntries, diagnosticsEnabled, getSessionStatus],
  )
  return <RouterProvider router={resolved} />
}
