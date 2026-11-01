import { assign, setup } from 'xstate'
import type { PaidActionAttempt } from './paid-action-session.ts'

export type RecallFlowPhase =
  'idle' | 'confirmingSync' | 'quoting' | 'rewriting' | 'reconsolidating' | 'result'
export interface RecallFlowContext {
  attempt: PaidActionAttempt | null
  consented: boolean
}
export type RecallFlowEvent =
  | { type: 'OPEN'; needsSync: boolean; attempt?: PaidActionAttempt }
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
  guards: { needsSync: ({ event }) => event.type === 'OPEN' && event.needsSync },
  actions: {
    start: assign(({ event }) => ({
      attempt: event.type === 'OPEN' ? (event.attempt ?? null) : null,
      consented: false,
    })),
    consent: assign({ consented: true }),
    reset: assign({ attempt: null, consented: false }),
    retry: assign(({ context, event }) => ({
      attempt: 'attempt' in event ? (event.attempt ?? context.attempt) : context.attempt,
    })),
  },
}).createMachine({
  id: 'recallFlow',
  initial: 'idle',
  context: { attempt: null, consented: false },
  states: {
    idle: {
      on: {
        OPEN: [
          { target: 'confirmingSync', guard: 'needsSync', actions: 'start' },
          { target: 'quoting', actions: 'start' },
        ],
      },
    },
    confirmingSync: {
      on: {
        ACCEPT: { target: 'quoting', actions: 'consent' },
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
        RECALL: 'reconsolidating',
        CLOSE: { target: 'idle', actions: 'reset' },
        SESSION_INVALIDATED: { target: 'idle', actions: 'reset' },
      },
    },
    // Ambiguous failure retains the paid intent and accepted quote; a known refusal re-quotes.
    reconsolidating: {
      on: {
        DONE: 'result',
        ERROR: 'rewriting',
        REQUOTE: { target: 'quoting', actions: 'retry' },
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
