import type { SessionStatus } from './session.ts'

// What the app entry should show for a given auth session status ([U1][U4]). The single shared
// piece of gate logic — both apps' entry hosts (web `/` guard, mobile nav root) map through it.
export type GateDecision = 'universe' | 'login' | 'landing' | 'hold'

// gateDecision is the whole gate rule. `authenticated` shows the universe. A settled `signedOut`
// visitor gets the LANDING page: the origin root is a stranger's first contact, and a password field
// for a product nobody has heard of is the wrong front door ([U4]). Every other signed-out status
// still goes to login — `signingIn` is where the pending sign-in lives, and `expired`/`failed` are
// returning users whose token died rather than marketing arrivals (`failed` is a signed-out user from
// the product's view, never an error screen; auth observability still fires upstream). While
// `bootstrapping` or `refreshing` the entry HOLDS in place: `refreshing` is provisionally
// authenticated (the userId is preserved across it), so neither a token refresh nor a cold load ever
// flashes login OR the landing — the entry commits only on a settled status.
export function gateDecision(status: SessionStatus): GateDecision {
  switch (status) {
    case 'authenticated':
      return 'universe'
    case 'bootstrapping':
    case 'refreshing':
      return 'hold'
    case 'signedOut':
      return 'landing'
    case 'signingIn':
    case 'expired':
    case 'failed':
      return 'login'
  }
}

/**
 * Whether a decision means "this person is not signed in" — true for `'login'` and `'landing'`.
 *
 * Widening the union was the dangerous part of adding a front door: every consumer used to ask
 * `=== 'login'`, and a fourth arm would have passed all of those comparisons silently, letting a
 * signed-out visitor into the authenticated subtree. Consumers ask this question instead, so a future
 * fifth decision is a compile error inside one exhaustive switch rather than a behaviour change spread
 * across four files.
 */
export function requiresSignIn(decision: GateDecision): boolean {
  switch (decision) {
    case 'login':
    case 'landing':
      return true
    case 'universe':
    case 'hold':
      return false
  }
}
