import { ObservedErrorBoundary, type ObservedErrorBoundaryFallbackProps } from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import type { ApiTransport } from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import type { ClientCacheQueryClient } from '@cosimosi/client-cache'
import type { Locale } from '@cosimosi/i18n'
import type { ObservabilityFacade } from '@cosimosi/observability'

import { TestPage } from '../pages/test/index.ts'
import { UniverseHomePage } from '../pages/universe/index.ts'
import { WebAuthProvider } from './providers/auth-provider.tsx'
import { WebI18nProvider } from './providers/i18n-provider.tsx'
import { WebObservabilityProvider, WebObservabilitySessionBridge } from './providers/observability-provider.tsx'
import { WebClientCacheProvider } from './providers/query-provider.tsx'

interface AppProps {
  routePath?: string
  authFacade?: AuthFacade
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
  observabilityFacade?: ObservabilityFacade
  locale?: Locale
}

export default function App({
  routePath = currentRoutePath(),
  authFacade,
  queryClient,
  transport,
  observabilityFacade,
  locale,
}: AppProps = {}) {
  const route = normalizeRoutePath(routePath) === '/test' ? 'test' : 'showcase'
  return (
    <WebObservabilityProvider facade={observabilityFacade}>
      <ObservedErrorBoundary fallback={WebAppErrorFallback}>
        <WebI18nProvider locale={locale}>
          <WebAuthProvider facade={authFacade}>
            <WebObservabilitySessionBridge />
            <WebClientCacheProvider queryClient={queryClient} transport={transport}>
              {route === 'test' ? <TestPage /> : <UniverseHomePage />}
            </WebClientCacheProvider>
          </WebAuthProvider>
        </WebI18nProvider>
      </ObservedErrorBoundary>
    </WebObservabilityProvider>
  )
}

function currentRoutePath(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

function normalizeRoutePath(routePath: string): string {
  const path = routePath.split(/[?#]/, 1)[0] ?? '/'
  if (path === '') return '/'
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function WebAppErrorFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center p-6">
      <Button onClick={resetErrorBoundary}>{m.common_retry()}</Button>
    </main>
  )
}
