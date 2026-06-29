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

function createDefaultWebAuthFacade(): AuthFacade {
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
