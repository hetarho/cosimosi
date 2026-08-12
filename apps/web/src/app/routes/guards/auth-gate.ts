import { redirect, type ParsedLocation } from '@tanstack/react-router'

import { gateDecision, requiresSignIn, type SessionStatus } from '@cosimosi/auth'

// The auth guard for the authenticated subtree. It runs in `beforeLoad`, before any product route
// mounts, and redirects a settled signed-out user to /login carrying where they were headed, so
// sign-in returns them there. Deliberately /login and NOT the root, which renders the same screen:
// someone deep-linking to /diary asked for a product route, and only /login can carry the return
// target they came with.
//
// A bootstrapping/refreshing (hold) or authenticated session passes — the authenticated layout then
// renders the neutral hold or the universe from the LIVE snapshot, so a product read (GetUniverse)
// never mounts for a signed-out session ([U1][A8]). Reads the status through the [04] facade accessor
// in the router context; it never touches Supabase or the session machine.
//
// `from` carries the pathname only (not the full href): the login route replays it as a route `to`.
// `/me` tab state is reload-stable for an authenticated session; a signed-out auth round trip
// intentionally returns to that page's default profile tab instead of replaying arbitrary search.
export function authGuardBeforeLoad(
  getSessionStatus: () => SessionStatus,
  location: ParsedLocation,
): void {
  if (requiresSignIn(gateDecision(getSessionStatus()))) {
    throw redirect({ to: '/login', search: { from: location.pathname } })
  }
}

// Where a completed sign-in returns to. `from` is user-visible URL input, so it is validated at
// the point of use, not trusted from the query string: only an internal single-slash pathname
// counts (never '//host' protocol-relative, never an absolute URL), and never '/login' itself —
// a crafted /login?from=/login must not pin an authenticated user to the login screen. '/' is in that
// set for exactly the same reason: the root renders the door, so replaying it would hand a freshly
// signed-in user the screen they just came through. Anything else falls back to the universe, which
// is its own route.
export function loginReturnTarget(from: string | undefined): string {
  if (
    !from ||
    !from.startsWith('/') ||
    from.startsWith('//') ||
    from === '/' ||
    from === '/login' ||
    from === '/signup' ||
    from.startsWith('/invite/')
  ) {
    return '/universe'
  }
  return from
}
