import { setup } from 'xstate'

/**
 * App-shell lifecycle (ARCHITECTURE §3.2: app-wide lifecycle machines live in
 * apps/<app>/src/app/model) — the first inhabitant of the app-wide-actor mount
 * point (MachineActorsProvider) and the documented seam later app-wide actors join.
 * It models the shell's boot→ready lifecycle: `booting` until the session seam (the
 * only asynchronous startup gate) leaves bootstrapping, then `ready`.
 *
 * Stack/route selection is NOT read from here — the auth gate (NavigationRoot) maps
 * the [04] session snapshot to a stack directly (no competing lifecycle authority).
 *
 * Context rule (spec/tech/state-machine.md): control state only — no session
 * objects, tokens, or server data. Those stay in the auth facade / Query cache.
 */
export type AppShellStatus = 'booting' | 'ready'

export type AppShellEvent = { type: 'READY' }

export const appShellMachine = setup({
  types: {
    events: {} as AppShellEvent,
  },
}).createMachine({
  id: 'appShell',
  initial: 'booting',
  states: {
    booting: {
      on: { READY: { target: 'ready' } },
    },
    ready: {},
  },
})
