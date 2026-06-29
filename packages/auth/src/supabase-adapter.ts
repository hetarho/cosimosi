import { createClient, type AuthSession as SupabaseSession, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'

import { VALUES } from '@cosimosi/config'

import type { AuthAdapter, AuthAdapterChangeSource, AuthSession, SignInCredentials } from './auth-adapter.ts'
import type { SessionSnapshot } from './session.ts'

export type SupabaseAuthStorage = SupportedStorage

export interface SupabaseAuthClientOptions {
  supabaseUrl: string
  publishableKey: string
  storage?: SupabaseAuthStorage
  storageKey?: string
  detectSessionInUrl?: boolean
  flowType?: 'implicit' | 'pkce'
}

export interface SupabaseAuthAdapterOptions {
  now?: () => number
}

export function createSupabaseAuthClient({
  supabaseUrl,
  publishableKey,
  storage,
  storageKey,
  detectSessionInUrl = true,
  flowType,
}: SupabaseAuthClientOptions): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl,
      flowType,
      storage,
      storageKey,
    },
  })
}

export function createSupabaseAuthAdapter(client: SupabaseClient, { now = Date.now }: SupabaseAuthAdapterOptions = {}): AuthAdapter {
  return {
    async bootstrap() {
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      return toAuthSession(data.session, now)
    },
    async signIn(credentials: SignInCredentials) {
      const { data, error } = await client.auth.signInWithPassword(credentials)
      if (error) throw error
      return requireAuthSession(data.session, now)
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw error
    },
    async refresh() {
      const { data, error } = await client.auth.refreshSession()
      if (error) throw error
      return requireAuthSession(data.session, now)
    },
    async getAccessToken() {
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      const session = data.session
      const raw = toRawAuthSession(session)
      if (!raw) return null
      if (shouldRefreshAccessToken(raw.expiresAt, now())) {
        const refreshed = await client.auth.refreshSession()
        if (refreshed.error) throw refreshed.error
        return accessTokenFromSession(refreshed.data.session, now)
      }
      return accessTokenFromSession(session, now)
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener(toSessionSnapshot(session, now), { source: toAuthAdapterChangeSource(event) })
      })
      return () => data.subscription.unsubscribe()
    },
  }
}

function toAuthAdapterChangeSource(event: string): AuthAdapterChangeSource {
  switch (event) {
    case 'INITIAL_SESSION':
      return 'initialSession'
    case 'SIGNED_IN':
      return 'signedIn'
    case 'SIGNED_OUT':
      return 'signedOut'
    case 'TOKEN_REFRESHED':
      return 'tokenRefreshed'
    case 'USER_UPDATED':
      return 'userUpdated'
    case 'PASSWORD_RECOVERY':
      return 'passwordRecovery'
    default:
      return 'external'
  }
}

function requireAuthSession(session: SupabaseSession | null, now: () => number): AuthSession {
  const converted = toAuthSession(session, now)
  if (!converted) throw new Error('Supabase did not return an authenticated session')
  return converted
}

function toAuthSession(session: SupabaseSession | null, now: () => number): AuthSession | null {
  const converted = toRawAuthSession(session)
  if (!converted || converted.expiresAt <= now()) return null
  return converted
}

function toRawAuthSession(session: SupabaseSession | null): AuthSession | null {
  if (!session?.user.id || session.expires_at === undefined) return null
  return {
    userId: session.user.id,
    expiresAt: session.expires_at * 1000,
  }
}

function accessTokenFromSession(session: SupabaseSession | null, now: () => number): string | null {
  return toAuthSession(session, now) ? (session?.access_token ?? null) : null
}

function shouldRefreshAccessToken(expiresAt: number, now: number): boolean {
  return expiresAt <= now + VALUES.authSession.accessTokenRefreshSkewMs
}

function toSessionSnapshot(session: SupabaseSession | null, now: () => number): SessionSnapshot {
  const converted = toRawAuthSession(session)
  if (!converted) {
    return { status: 'signedOut', userId: null, expiresAt: null, error: null }
  }
  if (converted.expiresAt <= now()) {
    return { status: 'expired', userId: null, expiresAt: null, error: null }
  }
  return { status: 'authenticated', userId: converted.userId, expiresAt: converted.expiresAt, error: null }
}
