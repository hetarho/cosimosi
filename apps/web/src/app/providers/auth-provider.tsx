import { type ReactNode } from 'react'

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  type AuthFacade,
} from '@cosimosi/auth'
import { AuthProvider } from '@cosimosi/auth/react'

interface WebAuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
}

export function WebAuthProvider({ children, facade }: WebAuthProviderProps) {
  return (
    <AuthProvider facade={facade} createFacade={createDefaultWebAuthFacade}>
      {children}
    </AuthProvider>
  )
}

// A dev fake session never expires (no code schedules a timer off expiresAt), so `pnpm dev`
// stays signed in without a refresh loop.
const DEV_SESSION_EXPIRES_AT = Number.MAX_SAFE_INTEGER

function createDefaultWebAuthFacade(): AuthFacade {
  const devUserId = import.meta.env.VITE_DEV_USER_ID
  if (devUserId && !import.meta.env.DEV) {
    // The dev sign-in bypass is an auth-bypass path — it must never ship in a production
    // build. Fail loud on misconfiguration instead of silently authenticating as a fake user.
    throw new Error('VITE_DEV_USER_ID must not be set in a production build (dev sign-in bypass)')
  }
  if (import.meta.env.DEV && devUserId) {
    // Dev-only sign-in bypass: an always-authenticated fake session so `pnpm dev` skips the
    // Supabase login round-trip. The API's matching dev verifier (COSIMOSI_DEV_AUTH +
    // COSIMOSI_DEV_USER_ID) accepts the resulting `fake-token-<id>` bearer as this same user.
    return createAuthFacade({
      adapter: new FakeAuthAdapter({ initial: { userId: devUserId, expiresAt: DEV_SESSION_EXPIRES_AT } }),
    })
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    return createAuthFacade({ adapter: new FakeAuthAdapter() })
  }
  return createAuthFacade({
    adapter: createSupabaseAuthAdapter(
      createSupabaseAuthClient({
        supabaseUrl,
        publishableKey,
        detectSessionInUrl: true,
      }),
    ),
  })
}
