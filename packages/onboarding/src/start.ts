/** Which of the two triggers opened this run. Nothing downstream branches on it; it names the pass. */
export type OnboardingStart = 'signup' | 'replay'

let replayRequested = false

/** Placed by the `/me` replay row just before it returns the user to the universe. */
export function requestOnboardingReplay(): void {
  replayRequested = true
}

/**
 * The entire exposure policy: the tour starts on the signup-completion signal, on an explicit replay
 * request, and on nothing else. A take-once read, run by `pages/universe` as it comes into view.
 *
 * **There is no "already seen" record, on the server or the client, and adding one is out of scope by
 * decision.** The `users` shape and the `AccountService` RPC inventory are closed, so no durable server
 * fact is available; a `localStorage` flag would be per-device, which turns "once, just after signup"
 * into "once per browser, possibly a year later on a new phone" — the wrong behaviour, not merely an
 * approximation. The guarantee is a property of the trigger instead: the profile gate makes `SignUp`
 * reachable only while no `users` row exists, so after it succeeds the completion signal has no second
 * occasion to be set.
 *
 * `signupCompleted` is a PARAMETER rather than a read, because the dependency edge runs the other way:
 * `@cosimosi/auth` imports this package for the reset inventory, so this package cannot import auth's
 * one-shot flag. The caller passes `takeSignupCompletion()`, which consumes it there.
 *
 * A pending replay is dropped whether or not it wins, so a request left behind by a route that never
 * arrived cannot open a tour on some later session. Signup takes precedence: it is the once-per-account
 * occasion, and both being pending would mean a run is starting anyway.
 */
export function takeOnboardingStart(signupCompleted: boolean): OnboardingStart | null {
  const replay = replayRequested
  replayRequested = false
  if (signupCompleted) return 'signup'
  return replay ? 'replay' : null
}

/** Drops a replay request that no universe mount ever consumed. */
export function clearOnboardingStart(): void {
  replayRequested = false
}
