import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { writingFlowMachine } from './writing-flow.machine.ts'

function actor() {
  return createActor(writingFlowMachine).start()
}

describe('writingFlowMachine', () => {
  it('walks the happy path idle → writing → splitting → reviewing → launching → done', () => {
    const flow = actor()
    expect(flow.getSnapshot().value).toBe('idle')
    flow.send({ type: 'OPEN' })
    expect(flow.getSnapshot().value).toBe('writing')
    flow.send({ type: 'SPLIT' })
    expect(flow.getSnapshot().value).toBe('splitting')
    flow.send({ type: 'SPLIT_OK' })
    expect(flow.getSnapshot().value).toBe('reviewing')
    flow.send({ type: 'LAUNCH' })
    expect(flow.getSnapshot().value).toBe('launching')
    flow.send({ type: 'LAUNCH_OK' })
    expect(flow.getSnapshot().value).toBe('done')
    flow.send({ type: 'RESET' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('returns to writing on a split error, retriable, with the error surfaced', () => {
    const flow = actor()
    flow.send({ type: 'OPEN' })
    flow.send({ type: 'SPLIT' })
    flow.send({ type: 'SPLIT_ERR', error: 'split' })
    expect(flow.getSnapshot().value).toBe('writing')
    expect(flow.getSnapshot().context.error).toBe('split')
    flow.send({ type: 'SPLIT' })
    expect(flow.getSnapshot().value).toBe('splitting')
    expect(flow.getSnapshot().context.error).toBeNull()
  })

  it('revises as a loading state and returns to reviewing on ok or error', () => {
    const flow = actor()
    flow.send({ type: 'OPEN' })
    flow.send({ type: 'SPLIT' })
    flow.send({ type: 'SPLIT_OK' })
    flow.send({ type: 'REVISE' })
    expect(flow.getSnapshot().value).toBe('revising')
    flow.send({ type: 'REVISE_ERR', error: 'revise' })
    expect(flow.getSnapshot().value).toBe('reviewing')
    expect(flow.getSnapshot().context.error).toBe('revise')
    flow.send({ type: 'REVISE' })
    flow.send({ type: 'REVISE_OK' })
    expect(flow.getSnapshot().value).toBe('reviewing')
  })

  it('rolls a failed launch back to a retriable reviewing (nothing persisted)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN' })
    flow.send({ type: 'SPLIT' })
    flow.send({ type: 'SPLIT_OK' })
    flow.send({ type: 'LAUNCH' })
    flow.send({ type: 'LAUNCH_ERR', error: 'launch' })
    expect(flow.getSnapshot().value).toBe('reviewing')
    expect(flow.getSnapshot().context.error).toBe('launch')
    flow.send({ type: 'LAUNCH' })
    expect(flow.getSnapshot().value).toBe('launching')
  })

  it('keeps hand-edits in reviewing via the EDIT self-transition', () => {
    const flow = actor()
    flow.send({ type: 'OPEN' })
    flow.send({ type: 'SPLIT' })
    flow.send({ type: 'SPLIT_OK' })
    flow.send({ type: 'EDIT' })
    expect(flow.getSnapshot().value).toBe('reviewing')
  })

  it('closes to idle from any live phase and ignores stale resolves', () => {
    const flow = actor()
    flow.send({ type: 'OPEN' })
    flow.send({ type: 'SPLIT' })
    flow.send({ type: 'CLOSE' })
    expect(flow.getSnapshot().value).toBe('idle')
    // A late SPLIT_OK arriving after close is not a valid idle event — ignored, not a transition.
    flow.send({ type: 'SPLIT_OK' })
    expect(flow.getSnapshot().value).toBe('idle')
  })
})
