import { type ReactNode } from 'react'

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  type AuthAdapter,
  type AuthFacade,
} from '@cosimosi/auth'
import { AuthProvider, useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'

import type { SecureTokenStorage } from '../../shared/native/index.ts'

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
      {children}
    </AuthProvider>
  )
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
  )
}

export { useAuthFacade, useSessionSnapshot }
