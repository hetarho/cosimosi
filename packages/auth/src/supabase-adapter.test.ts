import { describe, expect, it } from 'vitest'

import { createSupabaseAuthAdapter } from './supabase-adapter.ts'

describe('createSupabaseAuthAdapter', () => {
  it('does not bootstrap an expired stored session as authenticated', async () => {
    const adapter = createSupabaseAuthAdapter(fakeSupabaseClient(expiredSupabaseSession()))

    await expect(adapter.bootstrap()).resolves.toBeNull()
  })

  it('rejects expired sessions returned from sign-in and refresh commands', async () => {
    const adapter = createSupabaseAuthAdapter(fakeSupabaseClient(expiredSupabaseSession()))

    await expect(adapter.signIn({ email: 'a@b.co', password: 'pw' })).rejects.toThrow(
      'Supabase did not return an authenticated session',
    )
    await expect(adapter.refresh()).rejects.toThrow('Supabase did not return an authenticated session')
  })

  it('returns null access tokens for expired sessions', async () => {
    const adapter = createSupabaseAuthAdapter(fakeSupabaseClient(expiredSupabaseSession()))

    await expect(adapter.getAccessToken()).resolves.toBeNull()
  })
})

function fakeSupabaseClient(session: unknown) {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
  } as never
}

function expiredSupabaseSession() {
  return {
    access_token: 'expired-token',
    expires_at: Math.floor(Date.now() / 1000) - 60,
    user: { id: 'supabase-user-1' },
  }
}
