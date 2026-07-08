import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { universeTimeMachine, type UniverseTimeEvent } from './universe-time.machine.ts'

function actorAfter(events: readonly UniverseTimeEvent[]) {
  const actor = createActor(universeTimeMachine)
  actor.start()
  for (const event of events) actor.send(event)
  return actor
}

describe('universeTimeMachine', () => {
  it('starts idle', () => {
    expect(actorAfter([]).getSnapshot().value).toBe('idle')
  })

  it('accelerates on a moving interval and returns to idle on DONE', () => {
    const actor = actorAfter([{ type: 'ADVANCED', empty: false }])
    expect(actor.getSnapshot().value).toBe('accelerating')
    actor.send({ type: 'DONE' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('never enters accelerating for an empty interval', () => {
    expect(actorAfter([{ type: 'ADVANCED', empty: true }]).getSnapshot().value).toBe('idle')
  })

  it('confirms a sync and returns to idle on either decision', () => {
    const accepted = actorAfter([{ type: 'CONFIRM_SYNC' }])
    expect(accepted.getSnapshot().value).toBe('confirming')
    accepted.send({ type: 'ACCEPT' })
    expect(accepted.getSnapshot().value).toBe('idle')

    const rejected = actorAfter([{ type: 'CONFIRM_SYNC' }, { type: 'REJECT' }])
    expect(rejected.getSnapshot().value).toBe('idle')
  })

  it('ignores events outside their phase', () => {
    expect(actorAfter([{ type: 'DONE' }]).getSnapshot().value).toBe('idle')
    expect(actorAfter([{ type: 'ACCEPT' }]).getSnapshot().value).toBe('idle')

    const confirming = actorAfter([{ type: 'CONFIRM_SYNC' }, { type: 'ADVANCED', empty: false }])
    expect(confirming.getSnapshot().value).toBe('confirming')

    const accelerating = actorAfter([{ type: 'ADVANCED', empty: false }, { type: 'CONFIRM_SYNC' }])
    expect(accelerating.getSnapshot().value).toBe('accelerating')
  })

  it('keeps snapshots serializable with no payload in context (§3.2)', () => {
    const snapshot = actorAfter([{ type: 'ADVANCED', empty: false }]).getSnapshot()
    expect(JSON.parse(JSON.stringify(snapshot.context))).toEqual({})
  })
})
