import { assign, setup } from 'xstate'

/**
 * Test-harness / overlay panel lifecycle: closed → open → loading → ready |
 * error → closed. Designed for the `/test` page panels and feature overlays
 * that load data on open. Context carries only the control mode + diagnostic
 * error; loaded rows live in the Query cache and are looked up by id.
 * ARCHITECTURE §3.2: control state only.
 */
export type PanelStatus = 'closed' | 'open' | 'loading' | 'ready' | 'error'

export interface PanelSnapshot {
  status: PanelStatus
  /** Caller-supplied id of the panel instance; null when no panel has been opened. */
  panelId: string | null
  /** Surfaced when an open or load fails; opaque to feature code. */
  error: string | null
  /** Wall-clock ms supplied by the caller on OPEN, for diagnostic UI. The
   *  machine itself never calls Date.now() so it stays a pure (state, event) → state. */
  lastOpenedAt: number | null
}

export const initialPanelSnapshot: PanelSnapshot = {
  status: 'closed',
  panelId: null,
  error: null,
  lastOpenedAt: null,
}

export type PanelEvent =
  | { type: 'OPEN'; panelId: string; openedAt: number }
  | { type: 'CLOSE' }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_FAILURE'; error: string }
  | { type: 'RESET' }

export const panelMachine = setup({
  types: {
    context: {} as PanelSnapshot,
    events: {} as PanelEvent,
  },
  actions: {
    // openedAt is supplied by the caller so the machine stays a pure function
    // of (state, event) — no Date.now() inside the action, replayable in tests.
    setOpen: assign(({ event }) =>
      event.type === 'OPEN'
        ? {
            status: 'open' as const,
            panelId: event.panelId,
            error: null,
            lastOpenedAt: event.openedAt,
          }
        : {},
    ),
    setLoading: assign({
      status: 'loading' as const,
      error: null,
    }),
    setReady: assign({ status: 'ready' as const, error: null }),
    setError: assign(({ event }) =>
      event.type === 'LOAD_FAILURE' ? { status: 'error' as const, error: event.error } : {},
    ),
    setClosed: assign(initialPanelSnapshot),
  },
}).createMachine({
  id: 'panel',
  context: initialPanelSnapshot,
  initial: 'closed',
  states: {
    closed: {
      on: { OPEN: { target: 'open', actions: 'setOpen' } },
    },
    open: {
      on: {
        LOAD_START: { target: 'loading', actions: 'setLoading' },
        LOAD_FAILURE: { target: 'error', actions: 'setError' },
        CLOSE: { target: 'closed', actions: 'setClosed' },
      },
    },
    loading: {
      on: {
        LOAD_SUCCESS: { target: 'ready', actions: 'setReady' },
        LOAD_FAILURE: { target: 'error', actions: 'setError' },
        CLOSE: { target: 'closed', actions: 'setClosed' },
      },
    },
    ready: {
      on: {
        LOAD_START: { target: 'loading', actions: 'setLoading' },
        CLOSE: { target: 'closed', actions: 'setClosed' },
      },
    },
    error: {
      on: {
        LOAD_START: { target: 'loading', actions: 'setLoading' },
        CLOSE: { target: 'closed', actions: 'setClosed' },
        RESET: { target: 'closed', actions: 'setClosed' },
      },
    },
  },
})
