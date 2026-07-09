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
    await expect(adapter.refresh()).rejects.toThrow(
      'Supabase did not return an authenticated session',
    )
  })

  it('refreshes expired sessions before returning access tokens', async () => {
    const now = Date.UTC(2026, 5, 29, 12, 0, 0)
    let refreshCalls = 0
    const adapter = createSupabaseAuthAdapter(
      fakeSupabaseClient(
        supabaseSession({ accessToken: 'expired-token', expiresAt: now - 1_000 }),
        {
          refreshedSession: supabaseSession({
            accessToken: 'fresh-token',
            expiresAt: now + 60_000,
          }),
          onRefresh: () => {
            refreshCalls += 1
          },
        },
      ),
      { now: () => now },
    )

    await expect(adapter.getAccessToken()).resolves.toBe('fresh-token')
    expect(refreshCalls).toBe(1)
  })

  it('refreshes near-expiry sessions before returning access tokens', async () => {
    const now = Date.UTC(2026, 5, 29, 12, 0, 0)
    let refreshCalls = 0
    const adapter = createSupabaseAuthAdapter(
      fakeSupabaseClient(
        supabaseSession({ accessToken: 'nearly-expired-token', expiresAt: now + 30_000 }),
        {
          refreshedSession: supabaseSession({
            accessToken: 'fresh-token',
            expiresAt: now + 300_000,
          }),
          onRefresh: () => {
            refreshCalls += 1
          },
        },
      ),
      { now: () => now },
    )

    await expect(adapter.getAccessToken()).resolves.toBe('fresh-token')
    expect(refreshCalls).toBe(1)
  })
})

function fakeSupabaseClient(
  session: unknown,
  options: { refreshedSession?: unknown; onRefresh?: () => void } = {},
) {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
      refreshSession: async () => {
        options.onRefresh?.()
        return { data: { session: options.refreshedSession ?? session }, error: null }
      },
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
  return supabaseSession({
    accessToken: 'expired-token',
    expiresAt: Date.now() - 60_000,
  })
}

function supabaseSession({ accessToken, expiresAt }: { accessToken: string; expiresAt: number }) {
  return {
    access_token: accessToken,
    expires_at: Math.floor(expiresAt / 1000),
    user: { id: 'supabase-user-1' },
  }
}
