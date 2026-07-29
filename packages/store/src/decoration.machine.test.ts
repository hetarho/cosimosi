import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { decorationMachine } from './decoration.machine.ts'

function open() {
  const actor = createActor(decorationMachine).start()
  actor.send({ type: 'OPEN' })
  return actor
}

describe('decoration machine', () => {
  // The shape's whole promise: no exit from an open panel reaches `closed` without passing through a
  // state that either puts the preview back or lets it stand.
  it('never closes an open panel without reverting or committing', () => {
    const actor = open()
    actor.send({ type: 'CLOSE' })
    expect(actor.getSnapshot().value).toBe('reverting')
    actor.send({ type: 'SETTLED' })
    expect(actor.getSnapshot().value).toBe('closed')

    const saved = open()
    saved.send({ type: 'SAVE' })
    saved.send({ type: 'SAVED' })
    expect(saved.getSnapshot().value).toBe('committing')
    saved.send({ type: 'SETTLED' })
    expect(saved.getSnapshot().value).toBe('closed')
  })

  // A save in flight cannot be dismissed, so a resolved commit can never arrive at a panel that has
  // moved on to something else.
  it('refuses to close while a save is in flight', () => {
    const actor = open()
    actor.send({ type: 'SAVE' })
    actor.send({ type: 'CLOSE' })
    expect(actor.getSnapshot().value).toBe('saving')
  })

  it('returns to browsing with the reason when a save is refused, and clears it on the next try', () => {
    const actor = open()
    actor.send({ type: 'SAVE' })
    actor.send({ type: 'FAILED', reason: 'STORE_INSUFFICIENT_TWINKLE' })
    expect(actor.getSnapshot().value).toBe('browsing')
    expect(actor.getSnapshot().context.failureReason).toBe('STORE_INSUFFICIENT_TWINKLE')
    actor.send({ type: 'SAVE' })
    expect(actor.getSnapshot().context.failureReason).toBeNull()
  })
})
