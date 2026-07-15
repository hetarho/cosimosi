import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { stardustMachine } from './stardust.machine.ts'

function actor() {
  return createActor(stardustMachine).start()
}

describe('stardustMachine', () => {
  it('starts idle with the charge sheet closed', () => {
    expect(actor().getSnapshot().value).toBe('idle')
  })

  it('OPEN_CHARGE opens the charge sheet (a shortfall path, never a dead end)', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    expect(sheet.getSnapshot().value).toBe('charging')
  })

  it('pay path: charging → paying → idle once the backend confirms', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'PAY' })
    expect(sheet.getSnapshot().value).toBe('paying')
    sheet.send({ type: 'DONE' })
    expect(sheet.getSnapshot().value).toBe('idle')
  })

  it('invite path: charging → inviting → idle once the grant resolves', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'INVITE' })
    expect(sheet.getSnapshot().value).toBe('inviting')
    sheet.send({ type: 'DONE' })
    expect(sheet.getSnapshot().value).toBe('idle')
  })

  it('a failed payment returns to a retriable charging', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'PAY' })
    sheet.send({ type: 'ERROR' })
    expect(sheet.getSnapshot().value).toBe('charging')
    sheet.send({ type: 'PAY' })
    expect(sheet.getSnapshot().value).toBe('paying')
  })

  it('a failed invite returns to a retriable charging', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'INVITE' })
    sheet.send({ type: 'ERROR' })
    expect(sheet.getSnapshot().value).toBe('charging')
    sheet.send({ type: 'INVITE' })
    expect(sheet.getSnapshot().value).toBe('inviting')
  })

  it('CLOSE from charging returns to idle', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'CLOSE' })
    expect(sheet.getSnapshot().value).toBe('idle')
  })

  it('a payment in flight cannot be closed — only done or error release it', () => {
    const sheet = actor()
    sheet.send({ type: 'OPEN_CHARGE' })
    sheet.send({ type: 'PAY' })
    sheet.send({ type: 'CLOSE' })
    expect(sheet.getSnapshot().value).toBe('paying')
  })
})
