import { assign, setup } from 'xstate'

/**
 * Generic local-command lifecycle: idle → submitting → succeeded | failed |
 * cancelled. Feature code instantiates this for a one-shot command (e.g. a
 * write, a use-case invocation) and resolves/rejects it from the caller. It
 * owns only control metadata — the command payload and any data result live in
 * the caller / cache, referenced by id. ARCHITECTURE §3.2: control state only.
 */
export type AsyncCommandStatus =
  | 'idle'
  | 'submitting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface AsyncCommandSnapshot {
  status: AsyncCommandStatus
  /** Caller-supplied id for the in-flight or last-finished command; null when idle. */
  commandId: string | null
  /** Optional id of the resource a succeeded command produced (caller-defined). */
  resultId: string | null
  /** Diagnostic string surfaced to the UI on failure; never a transport error object. */
  error: string | null
  /** Monotonic epoch counter — incremented on every SUBMIT, never reset, so the
   *  caller can discard a late RESOLVE/REJECT whose attempt != current. */
  attempt: number
}

export const initialAsyncCommandSnapshot: AsyncCommandSnapshot = {
  status: 'idle',
  commandId: null,
  resultId: null,
  error: null,
  attempt: 0,
}

export type AsyncCommandEvent =
  | { type: 'SUBMIT'; commandId: string }
  | { type: 'RESOLVE'; resultId: string; attempt: number }
  | { type: 'REJECT'; error: string; attempt: number }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

export const asyncCommandMachine = setup({
  types: {
    context: {} as AsyncCommandSnapshot,
    events: {} as AsyncCommandEvent,
  },
  actions: {
    setSubmitting: assign(({ context, event }) =>
      event.type === 'SUBMIT'
        ? {
            status: 'submitting' as const,
            commandId: event.commandId,
            resultId: null,
            error: null,
            attempt: context.attempt + 1,
          }
        : {},
    ),
    setSucceeded: assign(({ event }) =>
      event.type === 'RESOLVE'
        ? { status: 'succeeded' as const, resultId: event.resultId, error: null }
        : {},
    ),
    setFailed: assign(({ event }) =>
      event.type === 'REJECT' ? { status: 'failed' as const, error: event.error } : {},
    ),
    setCancelled: assign({
      status: 'cancelled' as const,
      resultId: null,
      error: null,
    }),
    setIdle: assign({
      status: 'idle' as const,
      commandId: null,
      resultId: null,
      error: null,
    }),
  },
  guards: {
    // A late RESOLVE/REJECT from an earlier SUBMIT must not flip the current
    // attempt's status. The caller echoes the attempt it observed when starting.
    matchesAttempt: ({ context, event }) =>
      (event.type === 'RESOLVE' || event.type === 'REJECT') && event.attempt === context.attempt,
  },
}).createMachine({
  id: 'asyncCommand',
  context: initialAsyncCommandSnapshot,
  initial: 'idle',
  states: {
    idle: {
      on: { SUBMIT: { target: 'submitting', actions: 'setSubmitting' } },
    },
    submitting: {
      on: {
        RESOLVE: [
          { target: 'succeeded', guard: 'matchesAttempt', actions: 'setSucceeded' },
        ],
        REJECT: [
          { target: 'failed', guard: 'matchesAttempt', actions: 'setFailed' },
        ],
        CANCEL: { target: 'cancelled', actions: 'setCancelled' },
      },
    },
    succeeded: {
      on: {
        SUBMIT: { target: 'submitting', actions: 'setSubmitting' },
        RESET: { target: 'idle', actions: 'setIdle' },
      },
    },
    failed: {
      on: {
        SUBMIT: { target: 'submitting', actions: 'setSubmitting' },
        RESET: { target: 'idle', actions: 'setIdle' },
      },
    },
    cancelled: {
      on: {
        SUBMIT: { target: 'submitting', actions: 'setSubmitting' },
        RESET: { target: 'idle', actions: 'setIdle' },
      },
    },
  },
})
