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
