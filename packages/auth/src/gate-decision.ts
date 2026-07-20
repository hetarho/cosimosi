import type { SessionStatus } from './session.ts'

// What the app entry should show for a given auth session status ([U1][U4]). The single shared
// piece of gate logic — both apps' entry hosts (web `/` guard, mobile nav root) map through it.
export type GateDecision = 'universe' | 'login' | 'hold'

// gateDecision is the whole gate rule. `authenticated` shows the universe. A SETTLED signed-out
// user goes to login — `signedOut`, `expired`, and `failed` alike; `failed` is a signed-out user
// from the product's view, never an error screen (auth observability still fires upstream), and
// `signingIn` stays on the login surface (that is where the pending sign-in lives). While
// `bootstrapping` or `refreshing` the entry HOLDS in place: `refreshing` is provisionally
// authenticated (the userId is preserved across it), so a refresh never flashes login — the entry
// only redirects on a settled signed-out.
//
// This mapping is the single insertion seam for a future (v2) landing surface: an unauthenticated
// user could later resolve to a `'landing'` decision here instead of `'login'`. Reserved, not built
// — v1 has no landing/marketing route.
export function gateDecision(status: SessionStatus): GateDecision {
  switch (status) {
    case 'authenticated':
      return 'universe'
    case 'bootstrapping':
    case 'refreshing':
      return 'hold'
    case 'signedOut':
    case 'signingIn':
    case 'expired':
    case 'failed':
      return 'login'
  }
}
