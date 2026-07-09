import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import {
  asyncCommandMachine,
  initialAsyncCommandSnapshot,
  type AsyncCommandSnapshot,
} from './async-command.machine.ts'
import { initialPanelSnapshot, panelMachine, type PanelSnapshot } from './panel.machine.ts'

/**
 * Machine context is id-and-control metadata only. Server collections,
 * graph/coordinate buffers, transport tokens,
 * and store snapshots are forbidden — those live in Query/Zustand/refs and are
 * selected by id. These tests hold the line on that contract for every catalog
 * machine so a future addition cannot quietly smuggle data in.
 */
describe('catalog machine context rule', () => {
  it('initial snapshots are JSON-serializable control-only payloads', () => {
    expect(JSON.parse(JSON.stringify(initialAsyncCommandSnapshot))).toEqual(
      initialAsyncCommandSnapshot,
    )
    expect(JSON.parse(JSON.stringify(initialPanelSnapshot))).toEqual(initialPanelSnapshot)
  })

  it('async-command context stays serializable across its full lifecycle', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    actor.send({ type: 'RESOLVE', resultId: 'mem-9', attempt: 1 })
    const snapshot: AsyncCommandSnapshot = actor.getSnapshot().context
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.keys(snapshot).sort()).toEqual([
      'attempt',
      'commandId',
      'error',
      'resultId',
      'status',
    ])
    actor.stop()
  })

  it('panel context stays serializable across its full lifecycle', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-x', openedAt: 1 })
    actor.send({ type: 'LOAD_START' })
    actor.send({ type: 'LOAD_FAILURE', error: 'oops' })
    const snapshot: PanelSnapshot = actor.getSnapshot().context
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.keys(snapshot).sort()).toEqual(['error', 'lastOpenedAt', 'panelId', 'status'])
    actor.stop()
  })

  it('context types stay control-only payloads', () => {
    // These literals must stay assignable as control-only payloads. The compile-time
    // guard is the closed Snapshot interface at each machine's definition — it is what
    // rejects a new non-control field (a Float32Array, collection, or transport object),
    // not this test.
    const asyncCmd: AsyncCommandSnapshot = {
      status: 'idle',
      commandId: null,
      resultId: null,
      error: null,
      attempt: 0,
    }
    const panel: PanelSnapshot = {
      status: 'closed',
      panelId: null,
      error: null,
      lastOpenedAt: null,
    }
    expect(asyncCmd.status).toBe('idle')
    expect(panel.status).toBe('closed')
  })
})
