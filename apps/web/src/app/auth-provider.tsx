import { useEffect, useMemo, type ReactNode } from 'react'

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  type AuthFacade,
} from '@cosimosi/auth'

import { AuthContext } from './auth-context.ts'

interface WebAuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
}

export function WebAuthProvider({ children, facade }: WebAuthProviderProps) {
  const binding = useMemo(
    () => (facade ? { auth: facade, owned: false } : { auth: createDefaultWebAuthFacade(), owned: true }),
    [facade],
  )
  useEffect(
    () => () => {
      if (binding.owned) binding.auth.dispose()
    },
    [binding],
  )
  return <AuthContext.Provider value={binding.auth}>{children}</AuthContext.Provider>
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
