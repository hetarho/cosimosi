import { redirect, type ParsedLocation } from '@tanstack/react-router'

import { gateDecision, type SessionStatus } from '@cosimosi/auth'

// The auth guard for the `/`-subtree (the seam the web-router foundation left open on `/`). It
// runs in `beforeLoad`, before any product route mounts, and redirects a SETTLED signed-out user
// (signedOut/expired/failed) to /login carrying where they were headed, so sign-in returns them
// there. A bootstrapping/refreshing (hold) or authenticated session passes — the authenticated
// layout then renders the neutral hold or the universe from the LIVE snapshot, so a product read
// (GetUniverse) never mounts for a signed-out session ([U1][A8]). Reads the status through the [04]
// facade accessor in the router context; it never touches Supabase or the session machine.
//
// `from` carries the pathname only (not the full href): the login route replays it as a route `to`,
// which takes a path, not a query string — v1's product routes hold no state in the query (the diary
// reader parks its target in a store, not the URL), so the pathname is the whole return target.
export function authGuardBeforeLoad(
  getSessionStatus: () => SessionStatus,
  location: ParsedLocation,
): void {
  if (gateDecision(getSessionStatus()) === 'login') {
    throw redirect({ to: '/login', search: { from: location.pathname } })
  }
}

// Where a completed sign-in returns to. `from` is user-visible URL input, so it is validated at
// the point of use, not trusted from the query string: only an internal single-slash pathname
// counts (never '//host' protocol-relative, never an absolute URL), and never '/login' itself —
// a crafted /login?from=/login must not pin an authenticated user to the login screen. Anything
// else falls back to the universe.
export function loginReturnTarget(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from === '/login') return '/'
  return from
}
