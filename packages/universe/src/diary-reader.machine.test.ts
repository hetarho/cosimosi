import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { diaryReaderMachine } from './diary-reader.machine.ts'

function actor() {
  return createActor(diaryReaderMachine).start()
}

describe('diaryReaderMachine', () => {
  it('resting state is browsing — reading the archive spends nothing', () => {
    expect(actor().getSnapshot().value).toBe('browsing')
  })

  it('clock behind: JUMP goes through the sync-consent before recalling, then flies', () => {
    const flow = actor()
    flow.send({ type: 'JUMP', needsSync: true })
    expect(flow.getSnapshot().value).toBe('confirming')
    flow.send({ type: 'ACCEPT' })
    expect(flow.getSnapshot().value).toBe('recalling')
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('flying')
  })

  it('at-today: JUMP recalls directly, no consent', () => {
    const flow = actor()
    flow.send({ type: 'JUMP', needsSync: false })
    expect(flow.getSnapshot().value).toBe('recalling')
  })

  it('rejecting the sync cancels the jump with the clock unmoved', () => {
    const flow = actor()
    flow.send({ type: 'JUMP', needsSync: true })
    flow.send({ type: 'REJECT' })
    expect(flow.getSnapshot().value).toBe('browsing')
  })

  it('a failed recall returns to a retriable browsing', () => {
    const flow = actor()
    flow.send({ type: 'JUMP', needsSync: false })
    flow.send({ type: 'ERROR' })
    expect(flow.getSnapshot().value).toBe('browsing')
    flow.send({ type: 'JUMP', needsSync: false })
    expect(flow.getSnapshot().value).toBe('recalling')
  })

  it('an unconsented-sync race re-shows the consent modal (A5)', () => {
    const flow = actor()
    flow.send({ type: 'JUMP', needsSync: false })
    expect(flow.getSnapshot().value).toBe('recalling')
    flow.send({ type: 'CONSENT_REQUIRED' })
    expect(flow.getSnapshot().value).toBe('confirming')
    flow.send({ type: 'ACCEPT' })
    expect(flow.getSnapshot().value).toBe('recalling')
  })
})
