import { setup } from 'xstate'

// The recall (회고하기) flow control-state (§3.2): which phase the summon-and-rewrite flow is in.
// Context is empty — the recalled memory id, the rewrite text, and the result all live in the
// Zustand store; the machine only sequences the phases. `confirmingSync` is entered only when the
// clock is behind today (the OPEN event carries that decision as a guard input, [R1a][T2]);
// `reconsolidating` is the loading phase covering the server-side LLM compare + atomic recall.
export type RecallFlowPhase = 'idle' | 'confirmingSync' | 'rewriting' | 'reconsolidating' | 'result'

export type RecallFlowEvent =
  | { type: 'OPEN'; needsSync: boolean }
  | { type: 'ACCEPT' }
  | { type: 'REJECT' }
  | { type: 'RECALL' }
  | { type: 'DONE' }
  | { type: 'ERROR' }
  | { type: 'CONSENT_REQUIRED' }
  | { type: 'SESSION_INVALIDATED' }
  | { type: 'CLOSE' }
  | { type: 'RESET' }

export const recallFlowMachine = setup({
  types: {
    events: {} as RecallFlowEvent,
  },
  guards: {
    // The clock is behind today → consent is required before the recall's server-side sync ([R1a]).
    needsSync: ({ event }) => event.type === 'OPEN' && event.needsSync,
  },
}).createMachine({
  id: 'recallFlow',
  initial: 'idle',
  states: {
    idle: {
      on: {
        OPEN: [{ target: 'confirmingSync', guard: 'needsSync' }, { target: 'rewriting' }],
      },
    },
    // The reusable sync-consent modal ([T2] case 2): 예 → rewrite, 아니오 → cancel with the clock
    // unmoved (the recall's sync only fires server-side on the later RECALL, never here).
    confirmingSync: {
      on: {
        ACCEPT: 'rewriting',
        REJECT: 'idle',
        CLOSE: 'idle',
        SESSION_INVALIDATED: 'idle',
      },
    },
    rewriting: {
      on: {
        RECALL: 'reconsolidating',
        CLOSE: 'idle',
        SESSION_INVALIDATED: 'idle',
      },
    },
    // "떠올리는 중" — the single synchronous Recall covers sync + compare + recall atomically.
    // Non-dismissible (A4): no CLOSE — an in-flight paid action cannot be escaped/backdropped/X'd,
    // so a late completion can never mutate a closed/reopened flow. ERROR returns to a retriable
    // rewriting with the rewrite text intact (the store keeps it, A8); CONSENT_REQUIRED is the
    // pre-spend consent-race backstop — the server refused an unconsented sync, so re-show consent.
    reconsolidating: {
      on: {
        DONE: 'result',
        ERROR: 'rewriting',
        CONSENT_REQUIRED: 'confirmingSync',
        SESSION_INVALIDATED: 'idle',
      },
    },
    result: {
      on: {
        RESET: 'idle',
        CLOSE: 'idle',
        SESSION_INVALIDATED: 'idle',
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
