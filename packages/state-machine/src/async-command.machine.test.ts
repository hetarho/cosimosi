import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { asyncCommandMachine, initialAsyncCommandSnapshot } from './async-command.machine.ts'

describe('async-command machine', () => {
  it('starts idle with the empty control snapshot', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    expect(actor.getSnapshot().context).toEqual(initialAsyncCommandSnapshot)
    actor.stop()
  })

  it('walks idle → submitting → succeeded and exposes the result id, not the payload', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    expect(actor.getSnapshot().context).toMatchObject({
      status: 'submitting',
      commandId: 'cmd-1',
      attempt: 1,
    })
    actor.send({ type: 'RESOLVE', resultId: 'mem-42', attempt: 1 })
    const snapshot = actor.getSnapshot().context
    expect(snapshot.status).toBe('succeeded')
    expect(snapshot.resultId).toBe('mem-42')
    expect(snapshot.commandId).toBe('cmd-1')
    actor.stop()
  })

  it('records failure with an opaque error string and allows retry from failed', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    actor.send({ type: 'REJECT', error: 'network down', attempt: 1 })
    expect(actor.getSnapshot().context).toMatchObject({ status: 'failed', error: 'network down' })
    actor.send({ type: 'SUBMIT', commandId: 'cmd-2' })
    expect(actor.getSnapshot().context).toMatchObject({
      status: 'submitting',
      commandId: 'cmd-2',
      attempt: 2,
      error: null,
    })
    actor.stop()
  })

  it('supports cancellation while submitting', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    actor.send({ type: 'CANCEL' })
    expect(actor.getSnapshot().context).toMatchObject({
      status: 'cancelled',
      resultId: null,
      error: null,
    })
    actor.stop()
  })

  it('ignores a stale RESOLVE whose attempt predates the current SUBMIT', () => {
    // Covers the race: SUBMIT#1 → CANCEL → SUBMIT#2 → late RESOLVE#1.
    // The machine must not let the stale promise flip attempt #2 to succeeded.
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' }) // attempt = 1
    actor.send({ type: 'CANCEL' })
    actor.send({ type: 'SUBMIT', commandId: 'cmd-2' }) // attempt = 2
    actor.send({ type: 'RESOLVE', resultId: 'mem-stale', attempt: 1 })
    expect(actor.getSnapshot().context.status).toBe('submitting')
    expect(actor.getSnapshot().context.resultId).toBeNull()
    // The matching resolution still lands:
    actor.send({ type: 'RESOLVE', resultId: 'mem-fresh', attempt: 2 })
    expect(actor.getSnapshot().context).toMatchObject({
      status: 'succeeded',
      resultId: 'mem-fresh',
      attempt: 2,
    })
    actor.stop()
  })

  it('ignores a stale REJECT whose attempt predates the current SUBMIT', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' }) // attempt = 1
    actor.send({ type: 'CANCEL' })
    actor.send({ type: 'SUBMIT', commandId: 'cmd-2' }) // attempt = 2
    actor.send({ type: 'REJECT', error: 'stale', attempt: 1 })
    expect(actor.getSnapshot().context.status).toBe('submitting')
    expect(actor.getSnapshot().context.error).toBeNull()
    actor.send({ type: 'REJECT', error: 'fresh', attempt: 2 })
    expect(actor.getSnapshot().context).toMatchObject({ status: 'failed', error: 'fresh' })
    actor.stop()
  })

  it('returns to idle on RESET from any terminal state', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    actor.send({ type: 'REJECT', error: 'boom', attempt: 1 })
    actor.send({ type: 'RESET' })
    const snapshot = actor.getSnapshot().context
    expect(snapshot.status).toBe('idle')
    expect(snapshot.commandId).toBeNull()
    expect(snapshot.resultId).toBeNull()
    expect(snapshot.error).toBeNull()
    actor.stop()
  })

  it('keeps the attempt counter monotonic across retries and RESET (staleness guard)', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    actor.send({ type: 'REJECT', error: 'x', attempt: 1 })
    actor.send({ type: 'SUBMIT', commandId: 'cmd-2' })
    actor.send({ type: 'RESOLVE', resultId: 'mem-1', attempt: 2 })
    expect(actor.getSnapshot().context.attempt).toBe(2)
    actor.send({ type: 'RESET' })
    // attempt stays monotonic — a late RESOLVE from before RESET still mismatches.
    expect(actor.getSnapshot().context.attempt).toBe(2)
    actor.send({ type: 'SUBMIT', commandId: 'cmd-3' })
    expect(actor.getSnapshot().context.attempt).toBe(3)
    actor.stop()
  })

  it('ignores LOAD-style or unrelated events that are not in its contract', () => {
    const actor = createActor(asyncCommandMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', commandId: 'cmd-1' })
    // @ts-expect-error — verifying the machine rejects undocumented events at the type level
    actor.send({ type: 'LOAD_SUCCESS' })
    expect(actor.getSnapshot().context.status).toBe('submitting')
    actor.stop()
  })
})
