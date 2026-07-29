import { assign, setup } from 'xstate'

// The decoration panel's control-state (§3.2): which phase the panel is in, and why the last save
// failed. Nothing else — the previewed ids live in the preview store, the catalog and the balance in
// Query, and no ornament id ever enters this context.
//
// `committing` and `reverting` are TRANSIENT STATES rather than transition actions, and that is the
// whole point of the shape: there is no path from an open panel to `closed` that skips one of them,
// so a panel cannot be closed without either committing what it previewed or putting it back. And
// `saving` carries no CLOSE, so a stale completion can never land on a reopened panel.
export type DecorationPhase = 'closed' | 'browsing' | 'saving' | 'committing' | 'reverting'

export interface DecorationContext {
  /** The last save's refusal reason, for the panel to render. Cleared on every new attempt. */
  failureReason: string | null
}

export type DecorationEvent =
  | { type: 'OPEN' }
  | { type: 'SAVE' }
  | { type: 'SAVED' }
  | { type: 'FAILED'; reason: string }
  | { type: 'CLOSE' }
  | { type: 'SETTLED' }

export const decorationMachine = setup({
  types: {
    context: {} as DecorationContext,
    events: {} as DecorationEvent,
  },
  actions: {
    clearFailure: assign({ failureReason: null }),
    recordFailure: assign(({ event }) =>
      event.type === 'FAILED' ? { failureReason: event.reason } : {},
    ),
  },
}).createMachine({
  id: 'decoration',
  context: { failureReason: null },
  initial: 'closed',
  states: {
    closed: {
      on: { OPEN: { target: 'browsing', actions: 'clearFailure' } },
    },
    // Browsing is where a preview lives. CLOSE from here goes through `reverting`, never straight to
    // `closed`.
    browsing: {
      on: {
        SAVE: { target: 'saving', actions: 'clearFailure' },
        CLOSE: 'reverting',
      },
    },
    // Deliberately un-closable: the save is in flight, and a panel that could be dismissed here would
    // let a resolved commit arrive at a panel that has moved on.
    saving: {
      on: {
        SAVED: 'committing',
        FAILED: { target: 'browsing', actions: 'recordFailure' },
      },
    },
    committing: {
      on: { SETTLED: 'closed' },
    },
    reverting: {
      on: { SETTLED: 'closed' },
    },
  },
})
