import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { recallFlowMachine, recallOutcome } from './recall-flow.machine.ts'

function actor() {
  return createActor(recallFlowMachine).start()
}

describe('recallFlowMachine', () => {
  it('at-today flow: idle → rewriting → reconsolidating → result → idle', () => {
    const flow = actor()
    expect(flow.getSnapshot().value).toBe('idle')
    flow.send({ type: 'OPEN', needsSync: false })
    expect(flow.getSnapshot().value).toBe('rewriting')
    flow.send({ type: 'RECALL' })
    expect(flow.getSnapshot().value).toBe('reconsolidating')
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('result')
    flow.send({ type: 'RESET' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('clock behind: OPEN goes through the sync-consent modal before rewriting', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: true })
    expect(flow.getSnapshot().value).toBe('confirmingSync')
    flow.send({ type: 'ACCEPT' })
    expect(flow.getSnapshot().value).toBe('rewriting')
  })

  it('rejecting the sync cancels the whole flow (clock unmoved)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: true })
    flow.send({ type: 'REJECT' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('a failed recall returns to a retriable rewriting', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: false })
    flow.send({ type: 'RECALL' })
    flow.send({ type: 'ERROR' })
    expect(flow.getSnapshot().value).toBe('rewriting')
    flow.send({ type: 'RECALL' })
    expect(flow.getSnapshot().value).toBe('reconsolidating')
  })

  it('closes to idle from a dismissible pre-spend phase', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: false })
    expect(flow.getSnapshot().value).toBe('rewriting')
    flow.send({ type: 'CLOSE' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('is non-dismissible while reconsolidating (A4): CLOSE is ignored', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: false })
    flow.send({ type: 'RECALL' })
    expect(flow.getSnapshot().value).toBe('reconsolidating')
    flow.send({ type: 'CLOSE' })
    expect(flow.getSnapshot().value).toBe('reconsolidating')
  })

  it('invalidates an in-flight flow when its target or owning session changes', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: false })
    flow.send({ type: 'RECALL' })
    flow.send({ type: 'SESSION_INVALIDATED' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('an unconsented-sync race re-shows the consent modal (A5)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN', needsSync: false })
    flow.send({ type: 'RECALL' })
    flow.send({ type: 'CONSENT_REQUIRED' })
    expect(flow.getSnapshot().value).toBe('confirmingSync')
    flow.send({ type: 'ACCEPT' })
    expect(flow.getSnapshot().value).toBe('rewriting')
  })
})

describe('recallOutcome', () => {
  it('reflects the server branch, never decides it', () => {
    expect(recallOutcome(true)).toBe('reconsolidated')
    expect(recallOutcome(false)).toBe('reinforced')
  })
})
