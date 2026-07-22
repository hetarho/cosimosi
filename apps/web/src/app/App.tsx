import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import type { ApiTransport } from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import type { ClientCacheQueryClient } from '@cosimosi/client-cache'
import type { Locale } from '@cosimosi/i18n'
import type { ObservabilityFacade } from '@cosimosi/observability'

import { WebAuthProvider } from './providers/auth-provider.tsx'
import { WebI18nProvider } from './providers/i18n-provider.tsx'
import {
  WebObservabilityProvider,
  WebObservabilitySessionBridge,
} from './providers/observability-provider.tsx'
import { WebClientCacheProvider } from './providers/query-provider.tsx'
import { WebRouterProvider, createAppRouter } from './routes/index.ts'

interface AppProps {
  /** A preconfigured router (SSR tests inject a pre-loaded one); omitted in production. */
  router?: ReturnType<typeof createAppRouter>
  authFacade?: AuthFacade
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
  observabilityFacade?: ObservabilityFacade
  locale?: Locale
}

export default function App({
  router,
  authFacade,
  queryClient,
  transport,
  observabilityFacade,
  locale,
}: AppProps = {}) {
  return (
    <WebObservabilityProvider facade={observabilityFacade}>
      <ObservedErrorBoundary fallback={WebAppErrorFallback}>
        <WebI18nProvider locale={locale}>
          <WebAuthProvider facade={authFacade}>
            <WebObservabilitySessionBridge />
            <WebClientCacheProvider queryClient={queryClient} transport={transport}>
              <WebRouterProvider router={router} />
            </WebClientCacheProvider>
          </WebAuthProvider>
        </WebI18nProvider>
      </ObservedErrorBoundary>
    </WebObservabilityProvider>
  )
}

function WebAppErrorFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center p-6">
      <Button onClick={resetErrorBoundary}>{m.common_retry()}</Button>
    </main>
  )
}
