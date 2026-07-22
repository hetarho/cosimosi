import type { Transport } from '@connectrpc/connect'

import type { SessionSnapshot } from './session.ts'

/**
 * Auth-facing credentials. Adapter-specific (OTP, OAuth, magic link) can extend
 * this; the platform-pure contract only needs the email/password shape used by
 * the diagnostic/test path.
 */
export interface SignInCredentials {
  email: string
  password: string
}

/**
 * Result of an authenticated session — adapter-owned, never persists into the
 * XState machine context (which keeps only ids/status).
 */
export interface AuthSession {
  userId: string
  /** Unix epoch milliseconds; adapter decides refresh behavior from this. */
  expiresAt: number
}

export type AuthAdapterChangeSource =
  | 'initialSession'
  | 'signedIn'
  | 'signedOut'
  | 'tokenRefreshed'
  | 'userUpdated'
  | 'passwordRecovery'
  | 'external'

export interface AuthAdapterChange {
  source: AuthAdapterChangeSource
}

/**
 * Adapter that owns the Supabase client (web/mobile) or the in-memory fake (tests).
 * The provider translates these into XState events; feature code only sees the
 * resulting SessionSnapshot and the transport-facing token accessor.
 *
 * `getAccessToken` is the only transport hook: the Connect interceptor calls it
 * per RPC, so refresh is invisible to feature code.
 */
export interface AuthAdapter {
  /** Bootstrap from whatever storage the adapter owns; null when there is no session. */
  bootstrap(): Promise<AuthSession | null>
  signIn(credentials: SignInCredentials): Promise<AuthSession>
  /**
   * Begin the Google OAuth flow. Resolves the session when the sign-in completes
   * within the call (fake adapter); resolves null when the flow continues outside
   * the app (web full-page redirect / mobile system browser) — completion then
   * arrives through `onChange` (web return) or `completeOAuthSignIn` (mobile
   * deep-link callback).
   */
  signInWithGoogle(): Promise<AuthSession | null>
  /**
   * Finish an externally-continued OAuth flow from its callback URL (mobile PKCE:
   * exchange the callback's authorization code for a session).
   */
  completeOAuthSignIn(callbackUrl: string): Promise<AuthSession>
  signOut(): Promise<void>
  refresh(): Promise<AuthSession>
  /** Returns the current access token, refreshing first if the adapter deems it stale. */
  getAccessToken(): Promise<string | null>
  /** Subscribe to adapter-driven changes (token expiry, cross-tab sign-out, …). */
  onChange(listener: (snapshot: SessionSnapshot, change: AuthAdapterChange) => void): () => void
}

/**
 * Provider-facing façade. Web and mobile surface this from a React context; tests
 * can construct it directly without React.
 */
export interface AuthFacade {
  readonly snapshot: SessionSnapshot
  signIn(credentials: SignInCredentials): Promise<void>
  /** Begin Google OAuth; the machine may settle later when the flow leaves the app. */
  signInWithGoogle(): Promise<void>
  /** Finish an externally-continued OAuth flow from its callback URL (mobile deep link). */
  completeOAuthSignIn(callbackUrl: string): Promise<void>
  /**
   * Abandon a pending EXTERNAL OAuth attempt (`signingIn` → `signedOut`); a no-op in
   * any other state and for in-call sign-ins (password), which must be left to
   * resolve. Hosts call this when the OAuth flow is dismissed without a callback
   * (mobile app re-foregrounds, web bfcache restore), so the machine never sticks in
   * `signingIn`. A completion that still arrives afterwards simply drives a fresh
   * sign-in, so a premature cancel is harmless.
   */
  cancelSignIn(): void
  signOut(): Promise<void>
  refresh(): Promise<void>
  /** Transport hook used by the Connect auth interceptor. */
  getAccessToken(): Promise<string | null>
  /** React-free subscription; the provider wires this to component state. */
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void
  /** Stop the actor and unsubscribe adapter listeners when the owning provider unmounts. */
  dispose(): void
}

/**
 * Optional capability flag a transport can probe to know whether the adapter is
 * configured to attach bearer tokens (it is not, for instance, when running with
 * the fake adapter in offline tests).
 */
export interface AuthTransportOptions {
  /**
   * Called by the Connect interceptor to obtain the bearer token for the next RPC.
   * Returning null leaves the call anonymous (public-method allowlist territory).
   */
  getAccessToken?: () => Promise<string | null>
}

/** Marker so transports can carry their auth options inline. */
export interface AuthAwareTransport extends Transport {
  readonly auth?: AuthTransportOptions
}
