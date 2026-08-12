import type { SessionStatus } from './session.ts'

// What the app entry should show for a given auth session status ([U1][U4]). The single shared
// piece of gate logic — both apps' entry hosts (web `/` guard, mobile nav root) map through it.
export type GateDecision = 'universe' | 'login' | 'hold'

// gateDecision is the whole gate rule. `authenticated` shows the universe. EVERY signed-out status
// goes to the door: the origin root is the way in, and the page that introduces the product to a
// stranger is a public page of its own (`/about`) rather than something the session has to decide
// between ([U4]). `signingIn` is where a pending sign-in lives, and `expired`/`failed` are returning
// users whose token died (`failed` is a signed-out user from the product's view, never an error
// screen; auth observability still fires upstream). While `bootstrapping` or `refreshing` the entry
// HOLDS in place: `refreshing` is provisionally authenticated (the userId is preserved across it), so
// neither a token refresh nor a cold load ever flashes the door — the entry commits only on a settled
// status.
//
// The `'landing'` arm this used to carry is gone with the marketing page's move off `/`. It was the
// answer to "which of two surfaces does the root mean for a signed-out visitor"; the root now means
// one thing, so a decision that distinguished them would be a distinction nothing reads.
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

/**
 * Whether a decision means "this person is not signed in".
 *
 * Kept as an exhaustive `switch` even now that one arm answers it, because the hazard it was built
 * for has not gone anywhere: consumers that ask `=== 'login'` all pass silently the day a fourth
 * decision is added, and one of them is the guard on the authenticated subtree. Asking through here
 * makes that day a compile error inside one pure function instead of a behaviour change spread across
 * four files.
 */
export function requiresSignIn(decision: GateDecision): boolean {
  switch (decision) {
    case 'login':
      return true
    case 'universe':
    case 'hold':
      return false
  }
}
