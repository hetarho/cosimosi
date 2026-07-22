import { useEffect, type ReactNode } from 'react'

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  type AuthAdapter,
  type AuthFacade,
} from '@cosimosi/auth'
import { AuthProvider, useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'

import {
  mobileAuthCallbackUrl,
  openExternalUrl,
  subscribeToAuthCallbackUrls,
  type SecureTokenStorage,
} from '../../shared/native/index.ts'

// A dev fake session never expires (no code schedules a timer off expiresAt), so `pnpm ios`
// stays signed in without a refresh loop. Mirrors the web dev bypass.
const DEV_SESSION_EXPIRES_AT = Number.MAX_SAFE_INTEGER

interface MobileAuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
  supabase?: MobileSupabaseAuthOptions
  /** Dev sign-in bypass: an always-authenticated fake session as this user (local only). */
  devUserId?: string
}

export interface MobileSupabaseAuthOptions {
  supabaseUrl: string
  publishableKey: string
  /** Keychain/Keystore-backed token store from the native secure-storage seam. */
  secureStorage: SecureTokenStorage
  storageKey?: string
}

export function MobileAuthProvider({
  children,
  facade,
  supabase,
  devUserId,
}: MobileAuthProviderProps) {
  return (
    <AuthProvider
      facade={facade}
      createFacade={() =>
        createAuthFacade({ adapter: createDefaultMobileAuthAdapter(supabase, devUserId) })
      }
    >
      <OAuthCallbackBridge />
      {children}
    </AuthProvider>
  )
}

/**
 * Forwards inbound `cosimosi://auth-callback` deep links to the facade's OAuth
 * completion (ARCHITECTURE §3.5 — the app root owns auth-callback link parsing).
 * A failed exchange lands on the session snapshot's `error`, which the login
 * screen already surfaces — nothing to handle here.
 */
function OAuthCallbackBridge() {
  const facade = useAuthFacade()
  useEffect(
    () =>
      subscribeToAuthCallbackUrls((url) => {
        facade.completeOAuthSignIn(url).catch(() => undefined)
      }),
    [facade],
  )
  return null
}

function createDefaultMobileAuthAdapter(
  supabase: MobileSupabaseAuthOptions | undefined,
  devUserId: string | undefined,
): AuthAdapter {
  // Dev bypass takes precedence (mirrors the web provider): a pinned, never-expiring fake
  // session so local dev sees the seeded universe. Its fake-token-<id> is trusted only by
  // the api's dev verifier (COSIMOSI_DEV_AUTH + COSIMOSI_DEV_USER_ID).
  if (devUserId) {
    return new FakeAuthAdapter({
      initial: { userId: devUserId, expiresAt: DEV_SESSION_EXPIRES_AT },
    })
  }
  if (!supabase) return new FakeAuthAdapter()
  return createSupabaseAuthAdapter(
    createSupabaseAuthClient({
      supabaseUrl: supabase.supabaseUrl,
      publishableKey: supabase.publishableKey,
      storage: supabase.secureStorage,
      storageKey: supabase.storageKey,
      detectSessionInUrl: false,
      flowType: 'pkce',
    }),
    {
      // External-browser PKCE flow: consent opens in the system browser and returns
      // through the cosimosi:// callback, which OAuthCallbackBridge feeds back into
      // the facade for the code exchange.
      google: { redirectTo: mobileAuthCallbackUrl, openUrl: openExternalUrl },
    },
  )
}

export { useAuthFacade, useSessionSnapshot }
