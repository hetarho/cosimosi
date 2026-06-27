/**
 * Session model — the platform-pure shape both web and mobile auth providers expose
 * to feature slices. ARCHITECTURE §3.2: control state lives in XState, data/tokens
 * stay in the auth adapter. The XState machine context carries only these status /
 * id fields; access tokens and Supabase session objects never appear here.
 */
export type SessionStatus =
  | 'bootstrapping'
  | 'signedOut'
  | 'signingIn'
  | 'authenticated'
  | 'refreshing'
  | 'expired'
  | 'failed'

export interface SessionSnapshot {
  status: SessionStatus
  /** Present while the current authenticated session is usable or refreshing. */
  userId: string | null
  /** Adapter-owned metadata surfaced for refresh timing decisions; not a transport token. */
  expiresAt: number | null
  /** Surfaced for diagnostic/test auth UI. Opaque to feature code. */
  error: string | null
}

export const initialSessionSnapshot: SessionSnapshot = {
  status: 'bootstrapping',
  userId: null,
  expiresAt: null,
  error: null,
}
