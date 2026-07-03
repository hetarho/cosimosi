import { describe, expect, it } from 'vitest'

import { createActor } from 'xstate'

import { universeNavigationMachine } from './universe-navigation.machine.ts'

describe('universe navigation machine', () => {
  it('starts idle with no selection or travel target', () => {
    const actor = createActor(universeNavigationMachine).start()

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context).toEqual({ selectedNodeId: null, travelNodeId: null })
  })

  it('selects a node without leaving idle, and clears it', () => {
    const actor = createActor(universeNavigationMachine).start()

    actor.send({ type: 'SELECT', nodeId: 'neuron-1' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.selectedNodeId).toBe('neuron-1')

    actor.send({ type: 'CLEAR_SELECTION' })
    expect(actor.getSnapshot().context.selectedNodeId).toBeNull()
  })

  it('focuses a node and returns to idle on arrival', () => {
    const actor = createActor(universeNavigationMachine).start()

    actor.send({ type: 'FOCUS', nodeId: 'neuron-1' })
    expect(actor.getSnapshot().value).toBe('focusing')
    expect(actor.getSnapshot().context.travelNodeId).toBe('neuron-1')

    actor.send({ type: 'ARRIVED' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.travelNodeId).toBeNull()
  })

  it('flies to a node, allows retargeting mid-glide, and cancels back to idle', () => {
    const actor = createActor(universeNavigationMachine).start()

    actor.send({ type: 'FLY', nodeId: 'memory-1' })
    expect(actor.getSnapshot().value).toBe('flying')

    actor.send({ type: 'FLY', nodeId: 'memory-2' })
    expect(actor.getSnapshot().value).toBe('flying')
    expect(actor.getSnapshot().context.travelNodeId).toBe('memory-2')

    actor.send({ type: 'FOCUS', nodeId: 'neuron-1' })
    expect(actor.getSnapshot().value).toBe('focusing')
    expect(actor.getSnapshot().context.travelNodeId).toBe('neuron-1')

    actor.send({ type: 'CANCEL' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.travelNodeId).toBeNull()
  })

  it('keeps selection independent of travel state', () => {
    const actor = createActor(universeNavigationMachine).start()

    actor.send({ type: 'SELECT', nodeId: 'neuron-1' })
    actor.send({ type: 'FOCUS', nodeId: 'neuron-1' })
    actor.send({ type: 'SELECT', nodeId: 'neuron-2' })

    expect(actor.getSnapshot().value).toBe('focusing')
    expect(actor.getSnapshot().context.selectedNodeId).toBe('neuron-2')
    expect(actor.getSnapshot().context.travelNodeId).toBe('neuron-1')
  })

  it('holds ids only in context — no collections, coords, or snapshots (§3.2)', () => {
    const actor = createActor(universeNavigationMachine).start()
    actor.send({ type: 'SELECT', nodeId: 'neuron-1' })
    actor.send({ type: 'FLY', nodeId: 'memory-1' })

    for (const value of Object.values(actor.getSnapshot().context)) {
      expect(value === null || typeof value === 'string').toBe(true)
    }
  })
})
