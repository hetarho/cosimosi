import { createActor } from 'xstate'

import { appShellMachine } from './app-shell.machine.ts'

describe('appShellMachine', () => {
  it('starts in booting and transitions to ready exactly once on READY', () => {
    const actor = createActor(appShellMachine).start()
    expect(actor.getSnapshot().matches('booting')).toBe(true)

    actor.send({ type: 'READY' })
    expect(actor.getSnapshot().matches('ready')).toBe(true)

    // READY is idempotent — no transition away from ready.
    actor.send({ type: 'READY' })
    expect(actor.getSnapshot().matches('ready')).toBe(true)
    actor.stop()
  })
})
