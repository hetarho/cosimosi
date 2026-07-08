import { setup } from 'xstate'

/**
 * The time overlay's control-state (§3.2): exactly one of the three phases below. The clock value
 * and the advance interval are data (Zustand/Query) — context stays empty; ADVANCED carries only
 * an emptiness flag so the guard can skip a no-time-passed interval without holding it.
 *
 * `confirming` is the sync-consent modal ([T2] case 2 / [R1a]). ACCEPT parks back in `idle` on
 * purpose: the acceleration presents the *committed* sync interval, which the recall use-case
 * returns and announces through the same ADVANCED seam a launch uses — so the wait needs no fourth
 * state and the recall flow composes this machine unchanged. REJECT cancels with the clock unmoved.
 */
export type UniverseTimePhase = 'idle' | 'confirming' | 'accelerating'

export type UniverseTimeEvent =
  | { type: 'CONFIRM_SYNC' }
  | { type: 'ACCEPT' }
  | { type: 'REJECT' }
  | { type: 'ADVANCED'; empty: boolean }
  | { type: 'DONE' }

export const universeTimeMachine = setup({
  types: {
    events: {} as UniverseTimeEvent,
  },
  guards: {
    intervalMoves: ({ event }) => event.type === 'ADVANCED' && !event.empty,
  },
}).createMachine({
  id: 'universeTime',
  initial: 'idle',
  states: {
    idle: {
      on: {
        CONFIRM_SYNC: 'confirming',
        ADVANCED: { target: 'accelerating', guard: 'intervalMoves' },
      },
    },
    confirming: {
      on: {
        ACCEPT: 'idle',
        REJECT: 'idle',
      },
    },
    accelerating: {
      on: {
        DONE: 'idle',
      },
    },
  },
})
