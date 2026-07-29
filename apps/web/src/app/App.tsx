import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { presentAppError } from '@cosimosi/errors'
import type { ApiTransport } from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import type { ClientCacheQueryClient } from '@cosimosi/client-cache'
import type { ObservabilityFacade } from '@cosimosi/observability'

import { LocaleRenderBoundary, m, type Locale } from '../shared/i18n/index.ts'
import { WebAuthProvider } from './providers/auth-provider.tsx'
import { WebI18nProvider } from './providers/i18n-provider.tsx'
import { WebToastProvider } from './providers/toast-provider.tsx'
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
          <LocaleRenderBoundary>
            {() => (
              /* The toast queue wraps the error provider: the error path pushes into it rather than
                 rendering its own toast, so exactly one Toast exists in the tree. */
              <WebToastProvider>
                <WebAuthProvider facade={authFacade}>
                  <WebObservabilitySessionBridge />
                  <WebClientCacheProvider queryClient={queryClient} transport={transport}>
                    <WebRouterProvider router={router} />
                  </WebClientCacheProvider>
                </WebAuthProvider>
              </WebToastProvider>
            )}
          </LocaleRenderBoundary>
        </WebI18nProvider>
      </ObservedErrorBoundary>
    </WebObservabilityProvider>
  )
}

function WebAppErrorFallback({ error, resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  const presentation = presentAppError(error)
  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p>{presentation.message}</p>
        <Button onClick={resetErrorBoundary}>{m.common_retry()}</Button>
      </div>
    </main>
  )
}
