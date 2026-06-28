import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { initialPanelSnapshot, panelMachine } from './panel.machine.ts'

describe('panel machine', () => {
  it('starts closed with the empty control snapshot', () => {
    const actor = createActor(panelMachine)
    actor.start()
    expect(actor.getSnapshot().context).toEqual(initialPanelSnapshot)
    actor.stop()
  })

  it('walks closed → open → loading → ready without buffering the loaded rows', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-memories', openedAt: 1_700_000_000_000 })
    const openedSnapshot = actor.getSnapshot().context
    expect(openedSnapshot).toMatchObject({
      status: 'open',
      panelId: 'panel-memories',
      error: null,
      lastOpenedAt: 1_700_000_000_000,
    })
    actor.send({ type: 'LOAD_START' })
    expect(actor.getSnapshot().context.status).toBe('loading')
    actor.send({ type: 'LOAD_SUCCESS' })
    expect(actor.getSnapshot().context.status).toBe('ready')
    // Context carries only the id/mode — no rows surface here.
    expect(actor.getSnapshot().context).not.toHaveProperty('rows')
    actor.stop()
  })

  it('records load failure with an opaque diagnostic string and allows retry', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-x', openedAt: 1 })
    actor.send({ type: 'LOAD_START' })
    actor.send({ type: 'LOAD_FAILURE', error: 'unavailable' })
    expect(actor.getSnapshot().context).toMatchObject({ status: 'error', error: 'unavailable' })
    actor.send({ type: 'LOAD_START' })
    expect(actor.getSnapshot().context.status).toBe('loading')
    expect(actor.getSnapshot().context.error).toBeNull()
    actor.stop()
  })

  it('supports LOAD_FAILURE directly from open (e.g. synchronous open error)', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-y', openedAt: 1 })
    actor.send({ type: 'LOAD_FAILURE', error: 'no permission' })
    expect(actor.getSnapshot().context.status).toBe('error')
    actor.stop()
  })

  it('closes from any open/loading/ready/error state', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-z', openedAt: 1 })
    actor.send({ type: 'LOAD_START' })
    actor.send({ type: 'LOAD_SUCCESS' })
    actor.send({ type: 'CLOSE' })
    const closed = actor.getSnapshot().context
    expect(closed).toEqual(initialPanelSnapshot)
    actor.stop()
  })

  it('RESET from error returns to closed', () => {
    const actor = createActor(panelMachine)
    actor.start()
    actor.send({ type: 'OPEN', panelId: 'panel-z', openedAt: 1 })
    actor.send({ type: 'LOAD_FAILURE', error: 'bad' })
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().context).toEqual(initialPanelSnapshot)
    actor.stop()
  })

  it('ignores events that are not valid in the current state', () => {
    const actor = createActor(panelMachine)
    actor.start()
    // LOAD_SUCCESS while closed has no transition defined.
    actor.send({ type: 'LOAD_SUCCESS' })
    expect(actor.getSnapshot().context.status).toBe('closed')
    actor.stop()
  })
})
