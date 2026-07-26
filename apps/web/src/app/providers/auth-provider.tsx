import { useEffect, type ReactNode } from 'react'

import {
  FakeAuthAdapter,
  callbackUrlError,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  bindPendingInviteStorage,
  type AuthFacade,
  type PendingInviteStorage,
} from '@cosimosi/auth'
import { AuthProvider, useAuthFacade } from '@cosimosi/auth/react'

interface WebAuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
}

export function WebAuthProvider({ children, facade }: WebAuthProviderProps) {
  bindPendingInviteStorage(webPendingInviteStorage)
  return (
    <AuthProvider facade={facade} createFacade={createDefaultWebAuthFacade}>
      <OAuthErrorReturn>{children}</OAuthErrorReturn>
    </AuthProvider>
  )
}

const webPendingInviteStorage: PendingInviteStorage = {
  getItem(key) {
    try {
      return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      window.sessionStorage.setItem(key, value)
    } catch {
      // Storage can be unavailable in hardened/private contexts; signup remains
      // usable and the opaque invite simply cannot survive the OAuth redirect.
    }
  },
  removeItem(key) {
    try {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(key)
    } catch {
      // See setItem: absence is an inert invite, never a signup failure branch.
    }
  },
}

// A denied/failed Google consent redirects back to `/` with `?error=…` and NO session:
// `detectSessionInUrl` establishes nothing and the machine would settle `signedOut`, bouncing
// the visitor to a pristine login form with no feedback. Feed that callback URL through the
// facade (the same completeOAuthSignIn path mobile uses) so the machine reaches `failed` and
// the login page renders the Google-failure copy. Params are stripped first, so a refresh —
// or the StrictMode double-effect — cannot re-trigger the failure.
function OAuthErrorReturn({ children }: { children?: ReactNode }) {
  const facade = useAuthFacade()
  useEffect(() => {
    // Google returns only to the origin root (the one allowlisted redirect URL) — an
    // `error` param on any other route is not an OAuth callback and must keep its URL state.
    if (window.location.pathname !== '/') return
    const callbackUrl = window.location.href
    // GoTrue puts the error in the query or, for some classes, the hash fragment.
    if (callbackUrlError(callbackUrl) === null) return
    const url = new URL(callbackUrl)
    for (const param of ['error', 'error_description', 'error_code']) {
      url.searchParams.delete(param)
    }
    if (callbackUrlError(`#${url.hash.slice(1)}`) !== null) url.hash = ''
    window.history.replaceState(window.history.state, '', url.toString())
    facade.completeOAuthSignIn(callbackUrl).catch(() => undefined)
  }, [facade])
  return children
}

// A dev fake session never expires (no code schedules a timer off expiresAt), so `pnpm dev`
// stays signed in without a refresh loop.
const DEV_SESSION_EXPIRES_AT = Number.MAX_SAFE_INTEGER

function createDefaultWebAuthFacade(): AuthFacade {
  const devUserId = import.meta.env.VITE_DEV_USER_ID
  if (devUserId && !import.meta.env.DEV) {
    // The dev sign-in bypass is an auth-bypass path — it must never ship in a production
    // build. Fail loud on misconfiguration instead of silently authenticating as a fake user.
    throw new Error('VITE_DEV_USER_ID must not be set in a production build (dev sign-in bypass)')
  }
  if (import.meta.env.DEV && devUserId) {
    // Dev-only sign-in bypass: an always-authenticated fake session so `pnpm dev` skips the
    // Supabase login round-trip. The API's matching dev verifier (COSIMOSI_DEV_AUTH +
    // COSIMOSI_DEV_USER_ID) accepts the resulting `fake-token-<id>` bearer as this same user.
    return createAuthFacade({
      adapter: new FakeAuthAdapter({
        initial: { userId: devUserId, expiresAt: DEV_SESSION_EXPIRES_AT },
      }),
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
        // PKCE keeps tokens out of the OAuth return URL — implicit flow would land
        // them in the location fragment, where browser history retains them.
        flowType: 'pkce',
      }),
      {
        // Google returns the browser to the universe root; detectSessionInUrl then
        // establishes the session on load. The URL must be in the Supabase redirect
        // allowlist for every origin we serve (prod, localhost, previews) — an
        // unlisted origin silently falls back to the prod Site URL (DEPLOY.md §5).
        google: { redirectTo: `${window.location.origin}/` },
      },
    ),
  })
}
