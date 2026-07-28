let signupCompleted = false

/** Record the one-shot handoff consumed by the later onboarding owner. */
export function recordSignupCompletion(): void {
  signupCompleted = true
}

/** Read and clear the completion handoff. */
export function takeSignupCompletion(): boolean {
  const completed = signupCompleted
  signupCompleted = false
  return completed
}

/** Synchronous gate probe; the onboarding owner still consumes with takeSignupCompletion. */
export function hasSignupCompletion(): boolean {
  return signupCompleted
}

/** User-scope reset hook: unlike pending invites, this flag belongs to the new user. */
export function resetSignupUserState(): void {
  signupCompleted = false
}
