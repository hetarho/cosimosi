import { Code, ConnectError } from '@connectrpc/connect'

// A paid flow mints ONE operation id per intent and sends it with the
// recall/gist-view/diary-recall call; the server
// keys an idempotency receipt on it, so a response-loss retry with the SAME id + same input replays
// the committed result instead of spending again. The rules here decide when an id may be reused:
//
//   • ambiguous failure (network/timeout/internal) → the server MAY have committed, so the SAME id
//     is retried to recover the receipt rather than blind-spend a second time.
//   • known pre-commit refusal (consent required, insufficient balance, bad input, gone target) →
//     nothing committed, so once the user acknowledges (re-quotes / re-consents) the next attempt
//     mints a NEW id — a deliberate fresh spend, not a receipt recovery.
//
// The session controller below owns repeat-submit suppression and active-target/session fencing.
// Widgets keep one controller for their mounted lifetime and capture an attempt before awaiting;
// only an attempt that remains active may apply a response. Platform-agnostic — no DOM/native.

// newOperationId mints a fresh client operation id. It only needs to be unique per client attempt
// (the server scopes receipts by user), so it uses crypto.randomUUID when present and a
// timestamp+random fallback where it is not (bare React Native without a crypto polyfill).
export function newOperationId(): string {
  const runtime = globalThis.crypto
  if (runtime && typeof runtime.randomUUID === 'function') return runtime.randomUUID()
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface PaidActionAttempt {
  readonly operationId: string
  readonly targetKey: string
  readonly epoch: number
}

export interface PaidActionSession {
  begin(targetKey: string): PaidActionAttempt
  start(attempt: PaidActionAttempt): boolean
  isActive(attempt: PaidActionAttempt): boolean
  finish(attempt: PaidActionAttempt): boolean
  invalidate(attempt?: PaidActionAttempt): void
}

// createPaidActionSession is the shared web/native lifecycle boundary for paid requests. `start`
// is synchronous, so two taps in the same render cannot send twice. `finish` only releases the
// matching active request, so a stale request's finally block cannot clear a newer request's busy
// state. Invalidating on target/session changes and unmount makes late completions inert.
export function createPaidActionSession(
  mintOperationId: () => string = newOperationId,
): PaidActionSession {
  let epoch = 0
  let active: PaidActionAttempt | null = null
  let inFlight: PaidActionAttempt | null = null

  return {
    begin(targetKey) {
      epoch += 1
      const attempt = { operationId: mintOperationId(), targetKey, epoch }
      active = attempt
      inFlight = null
      return attempt
    },
    start(attempt) {
      if (active !== attempt || inFlight !== null) return false
      inFlight = attempt
      return true
    },
    isActive(attempt) {
      return active === attempt
    },
    finish(attempt) {
      if (active !== attempt || inFlight !== attempt) return false
      inFlight = null
      return true
    },
    invalidate(attempt) {
      if (attempt && active !== attempt) return
      epoch += 1
      active = null
      inFlight = null
    },
  }
}

// How a failed paid action's operation id may be reused (A5).
export type PaidActionRetry = 'known-refusal' | 'ambiguous'

// classifyPaidActionError decides reuse from the Connect code alone (so web and mobile share it): a
// KNOWN pre-commit refusal committed nothing (retry gets a fresh id); anything else is AMBIGUOUS —
// the commit state is unknown, so the same id is retried and the server replays the receipt if it
// did commit. Defaulting the unknown case to 'ambiguous' is the safe bias: it can never double-spend
// (the receipt guards it), whereas mis-classifying a committed loss as a known refusal would.
export function classifyPaidActionError(error: unknown): PaidActionRetry {
  if (error instanceof ConnectError) {
    switch (error.code) {
      case Code.ResourceExhausted: // insufficient twinkle
      case Code.FailedPrecondition: // consent required · gist stage not risen · target unavailable
      case Code.InvalidArgument: // malformed input / missing operation id
      case Code.NotFound: // target no longer exists
      case Code.AlreadyExists: // operation id reused for a different input
      case Code.Unauthenticated:
        return 'known-refusal'
      default:
        return 'ambiguous'
    }
  }
  return 'ambiguous'
}
