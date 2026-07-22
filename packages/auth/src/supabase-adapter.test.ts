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

  it('rejects Google sign-in when the adapter has no google wiring', async () => {
    const adapter = createSupabaseAuthAdapter(fakeSupabaseClient(null))
    await expect(adapter.signInWithGoogle()).rejects.toThrow(
      'Google sign-in is not configured for this adapter',
    )
  })

  it('starts the web Google flow as a same-page redirect and resolves null', async () => {
    let received: { provider?: string; options?: Record<string, unknown> } = {}
    const adapter = createSupabaseAuthAdapter(
      fakeSupabaseClient(null, {
        onSignInWithOAuth: (args) => {
          received = args
        },
      }),
      { google: { redirectTo: 'https://app.example/' } },
    )

    await expect(adapter.signInWithGoogle()).resolves.toBeNull()
    expect(received.provider).toBe('google')
    expect(received.options).toEqual({
      redirectTo: 'https://app.example/',
      skipBrowserRedirect: false,
    })
  })

  it('opens the consent URL externally when openUrl is provided (mobile flow)', async () => {
    const opened: string[] = []
    const adapter = createSupabaseAuthAdapter(
      fakeSupabaseClient(null, { oauthUrl: 'https://consent.example/google' }),
      {
        google: {
          redirectTo: 'cosimosi://auth-callback',
          openUrl: async (url) => {
            opened.push(url)
          },
        },
      },
    )

    await expect(adapter.signInWithGoogle()).resolves.toBeNull()
    expect(opened).toEqual(['https://consent.example/google'])
  })

  it('exchanges the callback code for a session', async () => {
    const now = Date.UTC(2026, 5, 29, 12, 0, 0)
    let exchangedCode: string | null = null
    const adapter = createSupabaseAuthAdapter(
      fakeSupabaseClient(supabaseSession({ accessToken: 't', expiresAt: now + 60_000 }), {
        onExchangeCode: (code) => {
          exchangedCode = code
        },
      }),
      { now: () => now },
    )

    const session = await adapter.completeOAuthSignIn('cosimosi://auth-callback?code=abc123')
    expect(exchangedCode).toBe('abc123')
    expect(session.userId).toBe('supabase-user-1')
  })

  it('surfaces provider errors and missing codes from the callback URL', async () => {
    const adapter = createSupabaseAuthAdapter(fakeSupabaseClient(null))
    await expect(
      adapter.completeOAuthSignIn(
        'cosimosi://auth-callback?error=access_denied&error_description=User+denied%20access',
      ),
    ).rejects.toThrow('User denied access')
    await expect(adapter.completeOAuthSignIn('cosimosi://auth-callback')).rejects.toThrow(
      'OAuth callback is missing the authorization code',
    )
  })
})

function fakeSupabaseClient(
  session: unknown,
  options: {
    refreshedSession?: unknown
    onRefresh?: () => void
    oauthUrl?: string
    onSignInWithOAuth?: (args: { provider: string; options: Record<string, unknown> }) => void
    onExchangeCode?: (code: string) => void
  } = {},
) {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signInWithOAuth: async (args: { provider: string; options: Record<string, unknown> }) => {
        options.onSignInWithOAuth?.(args)
        return { data: { url: options.oauthUrl ?? 'https://consent.example/' }, error: null }
      },
      exchangeCodeForSession: async (code: string) => {
        options.onExchangeCode?.(code)
        return { data: { session }, error: null }
      },
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
