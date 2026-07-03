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
  if (devUserId) {
    // Dev-only sign-in bypass: an always-authenticated fake session so `pnpm dev` skips the
    // Supabase login round-trip. The API's matching dev verifier (COSIMOSI_DEV_AUTH) accepts
    // the resulting `fake-token-<id>` bearer as this same user. Never set in a prod build.
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
