import { ObservedErrorBoundary, type ObservedErrorBoundaryFallbackProps } from '@cosimosi/observability/react'
import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { WebAuthProvider } from './auth-provider.tsx'
import { WebI18nProvider } from './i18n-provider.tsx'
import { WebObservabilityProvider, WebObservabilitySessionBridge } from './observability-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'
import { UiShowcase } from './ui-showcase.stories.tsx'

export default function App() {
  return (
    <WebObservabilityProvider>
      <ObservedErrorBoundary fallback={WebAppErrorFallback}>
        <WebI18nProvider>
          <WebAuthProvider>
            <WebObservabilitySessionBridge />
            <WebClientCacheProvider>
              <UiShowcase />
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
