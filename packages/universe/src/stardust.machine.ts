import { setup } from 'xstate'

// The charge sheet's control-state (§3.2): phase only. The balance figures, the
// pending-spend cost, and the charge results all live in Zustand/Query (entities/twinkle
// + the earn mutation state) — the machine holds no data and no context. A shortfall in
// the cost display opens this sheet (OPEN_CHARGE); the earn paths run through
// `paying`/`inviting`, and a failure is retriable (back to `charging`), never a dead end
// ([G3]). `paying`/`inviting` refuse CLOSE while the store round trip + backend
// verification are still resolving, so no credit is ever shown before the backend
// confirms it.
export type StardustPhase = 'idle' | 'charging' | 'paying' | 'inviting'

export type StardustEvent =
  | { type: 'OPEN_CHARGE' }
  | { type: 'PAY' }
  | { type: 'INVITE' }
  | { type: 'CLOSE' }
  | { type: 'DONE' }
  | { type: 'ERROR' }

export const stardustMachine = setup({
  types: {
    events: {} as StardustEvent,
  },
}).createMachine({
  id: 'stardust',
  initial: 'idle',
  states: {
    idle: {
      on: { OPEN_CHARGE: 'charging' },
    },
    charging: {
      on: { PAY: 'paying', INVITE: 'inviting', CLOSE: 'idle' },
    },
    paying: {
      on: { DONE: 'idle', ERROR: 'charging' },
    },
    inviting: {
      on: { DONE: 'idle', ERROR: 'charging' },
    },
  },
})
