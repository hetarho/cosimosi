import { assign, setup } from 'xstate'
import type { PaidActionAttempt } from './paid-action-session.ts'

// quoting shows the cost gate; viewing is the in-flight paid read (non-dismissible); revealed holds
// the gist text; failed keeps how the read failed so the retry can choose replay or re-quote.
export type GistViewPhase = 'quoting' | 'viewing' | 'revealed' | 'failed'
export type GistViewFailure = 'ambiguous' | 'known-refusal'

export interface GistViewContext {
  attempt: PaidActionAttempt | null
  text: string | null
  failure: GistViewFailure | null
}

export type GistViewEvent =
  | { type: 'START'; attempt: PaidActionAttempt }
  | { type: 'PROCEED' }
  | { type: 'REVEALED'; text: string }
  | { type: 'AMBIGUOUS' }
  | { type: 'REFUSED'; attempt: PaidActionAttempt }
  | { type: 'REQUOTE' }

// One owner for the view's phase and its paid intent. A new target restarts the view with a fresh
// attempt from any phase; an ambiguous failure keeps the attempt so its retry replays the receipt,
// and a known refusal carries the fresh attempt the next spend will use.
export const gistViewMachine = setup({
  types: { events: {} as GistViewEvent, context: {} as GistViewContext },
  actions: {
    start: assign(({ event }) =>
      event.type === 'START' ? { attempt: event.attempt, text: null, failure: null } : {},
    ),
  },
}).createMachine({
  id: 'gistView',
  initial: 'quoting',
  context: { attempt: null, text: null, failure: null },
  on: { START: { target: '.quoting', actions: 'start' } },
  states: {
    quoting: { on: { PROCEED: { target: 'viewing', actions: assign({ failure: null }) } } },
    viewing: {
      on: {
        REVEALED: {
          target: 'revealed',
          actions: assign(({ event }) => ({ text: event.text })),
        },
        AMBIGUOUS: { target: 'failed', actions: assign({ failure: 'ambiguous' as const }) },
        REFUSED: {
          target: 'failed',
          actions: assign(({ event }) => ({
            failure: 'known-refusal' as const,
            attempt: event.attempt,
          })),
        },
      },
    },
    revealed: {},
    failed: {
      on: {
        PROCEED: { target: 'viewing', guard: ({ context }) => context.failure === 'ambiguous' },
        REQUOTE: { target: 'quoting', actions: assign({ failure: null }) },
      },
    },
  },
})
