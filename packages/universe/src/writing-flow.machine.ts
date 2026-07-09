import { assign, setup } from 'xstate'

/**
 * The write-session control-state (§3.2): exactly one of the phases below. All data — the draft
 * body/date, the proposed memories, the edits — lives in Zustand/Query, never here; context holds
 * only the last diagnostic error. `splitting` / `revising` / `launching` are loading states the UI
 * shows a restrained affordance for; a failed split/revise/launch returns to a retriable state.
 */
export type WritingFlowStatus =
  'idle' | 'writing' | 'splitting' | 'reviewing' | 'revising' | 'launching' | 'done'

export interface WritingFlowContext {
  /** Surfaced on a failed split/revise/launch; opaque diagnostic, never a transport error object. */
  error: string | null
}

export type WritingFlowEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SPLIT' }
  | { type: 'SPLIT_OK' }
  | { type: 'SPLIT_ERR'; error: string }
  | { type: 'EDIT' }
  | { type: 'REVISE' }
  | { type: 'REVISE_OK' }
  | { type: 'REVISE_ERR'; error: string }
  | { type: 'BACK' }
  | { type: 'LAUNCH' }
  | { type: 'LAUNCH_OK' }
  | { type: 'LAUNCH_ERR'; error: string }
  | { type: 'RESET' }

export const writingFlowMachine = setup({
  types: {
    context: {} as WritingFlowContext,
    events: {} as WritingFlowEvent,
  },
  actions: {
    clearError: assign({ error: null }),
    setError: assign(({ event }) => ('error' in event ? { error: event.error } : {})),
  },
}).createMachine({
  id: 'writingFlow',
  context: { error: null },
  initial: 'idle',
  states: {
    idle: {
      on: { OPEN: { target: 'writing', actions: 'clearError' } },
    },
    writing: {
      on: {
        SPLIT: { target: 'splitting', actions: 'clearError' },
        CLOSE: 'idle',
      },
    },
    splitting: {
      on: {
        SPLIT_OK: 'reviewing',
        SPLIT_ERR: { target: 'writing', actions: 'setError' },
        CLOSE: 'idle',
      },
    },
    reviewing: {
      on: {
        EDIT: { actions: 'clearError' },
        REVISE: { target: 'revising', actions: 'clearError' },
        LAUNCH: { target: 'launching', actions: 'clearError' },
        BACK: 'writing',
        CLOSE: 'idle',
      },
    },
    revising: {
      on: {
        REVISE_OK: 'reviewing',
        REVISE_ERR: { target: 'reviewing', actions: 'setError' },
        CLOSE: 'idle',
      },
    },
    launching: {
      on: {
        LAUNCH_OK: 'done',
        LAUNCH_ERR: { target: 'reviewing', actions: 'setError' },
        CLOSE: 'idle',
      },
    },
    done: {
      on: {
        RESET: 'idle',
        CLOSE: 'idle',
      },
    },
  },
})
