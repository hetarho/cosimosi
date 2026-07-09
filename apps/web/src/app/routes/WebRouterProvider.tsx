import { useMemo } from 'react'

import { RouterProvider } from '@tanstack/react-router'

import { useObservabilityFacade } from '@cosimosi/observability/react'

import { diagnosticsSurfaceFlag } from '../../shared/config/index.ts'
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
  // The /test harness is always reachable in development; a production build
  // exposes it only when the diagnostics flag is explicitly on. `import.meta.env.DEV`
  // is true under the Vite dev server and false in a production build.
  const diagnosticsEnabled =
    import.meta.env.DEV || (observability.getFeatureFlag(diagnosticsSurfaceFlag) ?? false)
  const resolved = useMemo(
    () => router ?? createAppRouter({ diagnosticsEnabled, initialEntries }),
    [router, initialEntries, diagnosticsEnabled],
  )
  return <RouterProvider router={resolved} />
}
