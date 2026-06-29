import {setup} from 'xstate';

/**
 * App-shell lifecycle (ARCHITECTURE §3.2: app-wide lifecycle machines live in
 * apps/<app>/src/app/model). The shell starts in `booting` and transitions to
 * `ready` when the session seam — the only asynchronous startup gate — leaves
 * bootstrapping. Boot is the only sender of `READY`; navigation selects the active
 * route from this state.
 *
 * Context rule (spec/tech/state-machine.md): control state only — no session
 * objects, tokens, or server data. Those stay in the auth facade / Query cache.
 */
export type AppShellStatus = 'booting' | 'ready';

export type AppShellEvent = {type: 'READY'};

export const appShellMachine = setup({
  types: {
    events: {} as AppShellEvent,
  },
}).createMachine({
  id: 'appShell',
  initial: 'booting',
  states: {
    booting: {
      on: {READY: {target: 'ready'}},
    },
    ready: {},
  },
});
