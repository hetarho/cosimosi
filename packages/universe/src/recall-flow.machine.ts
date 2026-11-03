import { assign, setup } from 'xstate'
import type { PaidActionAttempt } from './paid-action-session.ts'

export type RecallFlowPhase =
  'idle' | 'confirmingSync' | 'quoting' | 'rewriting' | 'reconsolidating' | 'result'
export interface RecallFlowContext {
  attempt: PaidActionAttempt | null
  consented: boolean
  restore: boolean
  submitted: boolean
}
export type RecallFlowEvent =
  | { type: 'OPEN'; needsSync: boolean; restore?: boolean; attempt?: PaidActionAttempt }
  | { type: 'ACCEPT' }
  | { type: 'PROCEED' }
  | { type: 'REJECT' }
  | { type: 'RECALL' }
  | { type: 'DONE' }
  | { type: 'ERROR' }
  | { type: 'REQUOTE'; attempt?: PaidActionAttempt }
  | { type: 'CONSENT_REQUIRED'; attempt?: PaidActionAttempt }
  | { type: 'SESSION_INVALIDATED' }
  | { type: 'CLOSE' }
  | { type: 'RESET' }

// Interaction phase and intent identity have one owner. Text/results remain in the draft store.
export const recallFlowMachine = setup({
  types: { events: {} as RecallFlowEvent, context: {} as RecallFlowContext },
  guards: {
    needsSync: ({ event }) => event.type === 'OPEN' && event.needsSync,
    restore: ({ context, event }) =>
      event.type === 'OPEN' ? Boolean(event.restore) : context.restore,
  },
  actions: {
    start: assign(({ event }) => ({
      attempt: event.type === 'OPEN' ? (event.attempt ?? null) : null,
      consented: false,
      restore: event.type === 'OPEN' && Boolean(event.restore),
      submitted: false,
    })),
    consent: assign({ consented: true }),
    submitted: assign({ submitted: true }),
    reset: assign({ attempt: null, consented: false, restore: false, submitted: false }),
    retry: assign(({ context, event }) => ({
      attempt: 'attempt' in event ? (event.attempt ?? context.attempt) : context.attempt,
      submitted: false,
    })),
  },
}).createMachine({
  id: 'recallFlow',
  initial: 'idle',
  context: { attempt: null, consented: false, restore: false, submitted: false },
  states: {
    idle: {
      on: {
        OPEN: [
          { target: 'confirmingSync', guard: 'needsSync', actions: 'start' },
          { target: 'quoting', guard: 'restore', actions: 'start' },
          { target: 'rewriting', actions: 'start' },
        ],
      },
    },
    confirmingSync: {
      on: {
        ACCEPT: [
          { target: 'quoting', guard: 'restore', actions: 'consent' },
          { target: 'rewriting', actions: 'consent' },
        ],
        REJECT: { target: 'idle', actions: 'reset' },
        CLOSE: { target: 'idle', actions: 'reset' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
    quoting: {
      on: {
        PROCEED: 'rewriting',
        CLOSE: { target: 'idle', actions: 'reset' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
    rewriting: {
      on: {
        RECALL: { target: 'reconsolidating', actions: 'submitted' },
        CLOSE: { target: 'idle', actions: 'reset' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
    // Only restoration needs a quote; both intents retain their identity after ambiguous failure.
    reconsolidating: {
      on: {
        DONE: 'result',
        ERROR: 'rewriting',
        REQUOTE: [
          { target: 'quoting', guard: 'restore', actions: 'retry' },
          { target: 'rewriting', actions: 'retry' },
        ],
        CONSENT_REQUIRED: { target: 'confirmingSync', actions: 'retry' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
    result: {
      on: {
        RESET: { target: 'idle', actions: 'reset' },
        CLOSE: { target: 'idle', actions: 'reset' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
  },
})

// The server decides the branch, never the client ([R6] compare is server-side): the FE only
// reflects the response's `reconsolidated` flag.
export type RecallOutcome = 'reconsolidated' | 'reinforced'

export function recallOutcome(reconsolidated: boolean): RecallOutcome {
  return reconsolidated ? 'reconsolidated' : 'reinforced'
}
