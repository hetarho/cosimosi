import { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { m } from '@cosimosi/i18n'
import { presentAppError } from '@cosimosi/errors'
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react'
import { Button, tokens } from '@cosimosi/ui'
import type { ApiTransport } from '@cosimosi/api-client'
import type { AuthFacade } from '@cosimosi/auth'
import type { ClientCacheQueryClient } from '@cosimosi/client-cache'
import type { Locale } from '@cosimosi/i18n'
import type { ObservabilityFacade } from '@cosimosi/observability'

import { MobileAuthProvider, type MobileSupabaseAuthOptions } from './auth-provider.tsx'
import { MobileI18nProvider } from './i18n-provider.tsx'
import { MobileErrorProvider } from './error-provider.tsx'
import {
  MobileObservabilityProvider,
  MobileObservabilitySessionBridge,
} from './observability-provider.tsx'
import { MachineActorsProvider } from './machine-actors-provider.tsx'
import { MobileClientCacheProvider } from './query-provider.tsx'
import { MobileThemeProvider } from './theme-provider.tsx'

export interface MobileAppProvidersProps {
  children?: ReactNode
  /** Test/runtime overrides. When omitted, each provider builds its real adapter. */
  observabilityFacade?: ObservabilityFacade
  authFacade?: AuthFacade
  queryClient?: ClientCacheQueryClient
  transport?: ApiTransport
  locale?: Locale
  deviceLocale?: string
  apiBaseUrl?: string
  supabase?: MobileSupabaseAuthOptions
  /** Dev sign-in bypass user id (local only); the app root defaults it from mobileDevUserId. */
  devUserId?: string
}

/**
 * Composition root for the mobile shell. Provider order (outer → inner) is fixed
 * and exercised by the shell smoke test:
 *
 *   1. Observability — outermost so the error boundary below can report to it.
 *   2. ErrorBoundary  — catches render failures in every provider beneath it.
 *   3. i18n           — negotiates the active locale.
 *   4. Theme          — applies design-system tokens to the native surface.
 *   5. Error toast    — renders shared error presentations with native UI.
 *   6. Session (auth) — owns the session facade + secure-storage seam.
 *   7. Transport + QueryClient — one provider; the transport reads the live session.
 *   8. MachineActors  — app-wide XState actors (shell lifecycle).
 *   9. children       — NavigationRoot.
 *
 * Every long-lived provider lives here; feature slices never instantiate their
 * own. Each provider accepts a fake/test adapter so the shell renders in host
 * tests without Supabase, a real API, or native device features.
 */
export function MobileAppProviders({
  children,
  observabilityFacade,
  authFacade,
  queryClient,
  transport,
  locale,
  deviceLocale,
  apiBaseUrl,
  supabase,
  devUserId,
}: MobileAppProvidersProps) {
  return (
    <MobileObservabilityProvider facade={observabilityFacade}>
      <ObservedErrorBoundary fallback={MobileAppErrorFallback}>
        <MobileI18nProvider locale={locale} deviceLocale={deviceLocale}>
          <MobileThemeProvider>
            <MobileErrorProvider>
              <MobileAuthProvider facade={authFacade} supabase={supabase} devUserId={devUserId}>
                <MobileObservabilitySessionBridge />
                <MobileClientCacheProvider
                  queryClient={queryClient}
                  transport={transport}
                  apiBaseUrl={apiBaseUrl}
                >
                  <MachineActorsProvider>{children}</MachineActorsProvider>
                </MobileClientCacheProvider>
              </MobileAuthProvider>
            </MobileErrorProvider>
          </MobileThemeProvider>
        </MobileI18nProvider>
      </ObservedErrorBoundary>
    </MobileObservabilityProvider>
  )
}

function MobileAppErrorFallback({ error, resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  const presentation = presentAppError(error)
  return (
    <View style={styles.errorFallback}>
      <Text style={styles.errorMessage}>{presentation.message}</Text>
      <Button onPress={resetErrorBoundary}>{m.common_retry()}</Button>
    </View>
  )
}

const styles = StyleSheet.create({
  errorFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorMessage: {
    color: tokens.color.text,
    marginBottom: 16,
    textAlign: 'center',
  },
})
