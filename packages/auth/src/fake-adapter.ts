import type {
  AuthAdapter,
  AuthAdapterChangeSource,
  AuthSession,
  SignInCredentials,
} from './auth-adapter.ts'
import type { SessionSnapshot } from './session.ts'

interface FakeAdapterOptions {
  /** Initial session; omit to start signed-out. */
  initial?: AuthSession | null
  /** Force bootstrap to reject with this error (diagnostics). */
  bootstrapError?: string
  /** Override the access-token string returned to the transport. */
  accessToken?: (session: AuthSession | null) => string | null
  /** Force signIn to reject with this error (diagnostics). */
  signInError?: string
  /** Force signOut to reject with this error (diagnostics). */
  signOutError?: string
  /** Force refresh to reject with this error (diagnostics). */
  refreshError?: string
  /** Clock used for default token expiry checks. */
  now?: () => number
}

/**
 * In-memory auth adapter for tests and offline diagnostics. No Supabase, no IO;
 * dispatches lifecycle changes through `onChange` so a façade wiring it to the
 * XState machine observes the same events as the real adapters.
 */
export class FakeAuthAdapter implements AuthAdapter {
  private session: AuthSession | null
  private readonly accessTokenFn: (session: AuthSession | null) => string | null
  private readonly now: () => number
  private readonly listeners = new Set<Parameters<AuthAdapter['onChange']>[0]>()
  constructor(options: FakeAdapterOptions = {}) {
    this.session = options.initial ?? null
    this.accessTokenFn =
      options.accessToken ?? ((session) => (session ? `fake-token-${session.userId}` : null))
    this.now = options.now ?? Date.now
    if (options.bootstrapError !== undefined) this.bootstrapError = options.bootstrapError
    if (options.signInError !== undefined) this.signInError = options.signInError
    if (options.signOutError !== undefined) this.signOutError = options.signOutError
    if (options.refreshError !== undefined) this.refreshError = options.refreshError
  }

  private bootstrapError?: string
  private signInError?: string
  private signOutError?: string
  private refreshError?: string

  async bootstrap(): Promise<AuthSession | null> {
    if (this.bootstrapError) throw new Error(this.bootstrapError)
    return this.session
  }

  async signIn(credentials: SignInCredentials): Promise<AuthSession> {
    if (this.signInError) throw new Error(this.signInError)
    if (!credentials.email || !credentials.password) throw new Error('invalid credentials')
    const expiresAt = this.now() + 60_000
    this.session = { userId: `fake-user-${credentials.email}`, expiresAt }
    this.emit(
      { status: 'authenticated', userId: this.session.userId, expiresAt, error: null },
      'signedIn',
    )
    return this.session
  }

  async signOut(): Promise<void> {
    if (this.signOutError) throw new Error(this.signOutError)
    this.session = null
    this.emit({ status: 'signedOut', userId: null, expiresAt: null, error: null }, 'signedOut')
  }

  async refresh(): Promise<AuthSession> {
    if (this.refreshError) throw new Error(this.refreshError)
    if (!this.session) throw new Error('no session to refresh')
    const expiresAt = this.now() + 60_000
    this.session = { ...this.session, expiresAt }
    this.emit(
      { status: 'authenticated', userId: this.session.userId, expiresAt, error: null },
      'tokenRefreshed',
    )
    return this.session
  }

  async getAccessToken(): Promise<string | null> {
    if (this.session && this.session.expiresAt <= this.now()) {
      // The fake intentionally omits the real adapter's inline refresh: an expired
      // session exposes no token until the host triggers refresh.
      return null
    }
    return this.accessTokenFn(this.session)
  }

  onChange(listener: Parameters<AuthAdapter['onChange']>[0]): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Test/diagnostic hook: simulate a cross-tab sign-out or external expiry. */
  emit(snapshot: SessionSnapshot, source: AuthAdapterChangeSource = 'external'): void {
    for (const listener of this.listeners) listener(snapshot, { source })
  }
}
