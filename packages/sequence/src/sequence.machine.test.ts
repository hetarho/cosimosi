import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import {
  initialSequenceRunSnapshot,
  sequenceRunMachine,
  type SequenceRunSnapshot,
} from './sequence.machine.ts'

function startedRun(stepCount: number, runId = 'run-1') {
  const actor = createActor(sequenceRunMachine)
  actor.start()
  actor.send({ type: 'START', runId, stepCount })
  return actor
}

describe('sequence run machine', () => {
  it('walks a script to completion one current-step advance at a time', () => {
    const actor = startedRun(3)
    expect(actor.getSnapshot().value).toBe('running')

    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    actor.send({ type: 'ADVANCE', fromStepIndex: 1 })
    expect(actor.getSnapshot().context.stepIndex).toBe(2)
    expect(actor.getSnapshot().value).toBe('running')

    actor.send({ type: 'ADVANCE', fromStepIndex: 2 })
    expect(actor.getSnapshot().value).toBe('completed')
    expect(actor.getSnapshot().context.outcome).toBe('completed')
    actor.stop()
  })

  it('ignores a stale advance, so one press is worth exactly one step', () => {
    const actor = startedRun(4)
    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    // A double tap, a duplicated host signal, and a dwell timer from the superseded step all look
    // like this — and none of them may move the cursor a second time.
    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    expect(actor.getSnapshot().context.stepIndex).toBe(1)
    expect(actor.getSnapshot().value).toBe('running')

    // A future index is just as stale — an advance may only come from where the run actually is.
    actor.send({ type: 'ADVANCE', fromStepIndex: 3 })
    expect(actor.getSnapshot().context.stepIndex).toBe(1)
    actor.stop()
  })

  it('accepts SKIP on every step, with no confirmation and no step able to refuse', () => {
    for (let stopAt = 0; stopAt < 5; stopAt += 1) {
      const actor = startedRun(5)
      for (let step = 0; step < stopAt; step += 1) {
        actor.send({ type: 'ADVANCE', fromStepIndex: step })
      }
      expect(actor.getSnapshot().value).toBe('running')
      actor.send({ type: 'SKIP' })
      expect(actor.getSnapshot().value).toBe('skipped')
      expect(actor.getSnapshot().context.outcome).toBe('skipped')
      actor.stop()
    }
  })

  it('reports abandonment separately from a skip', () => {
    const actor = startedRun(3)
    actor.send({ type: 'ABANDON' })
    expect(actor.getSnapshot().value).toBe('abandoned')
    expect(actor.getSnapshot().context.outcome).toBe('abandoned')
    actor.stop()
  })

  it('replays from any terminal state with no teardown and no residue', () => {
    for (const end of [{ type: 'SKIP' }, { type: 'ABANDON' }] as const) {
      const actor = startedRun(2)
      actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
      actor.send(end)

      actor.send({ type: 'START', runId: 'run-2', stepCount: 2 })
      expect(actor.getSnapshot().value).toBe('running')
      expect(actor.getSnapshot().context).toEqual({
        runId: 'run-2',
        stepIndex: 0,
        stepCount: 2,
        outcome: null,
      })
      actor.stop()
    }

    // From `completed` too — a finished tour is replayable, which is the whole point of the entry.
    const finished = startedRun(1)
    finished.send({ type: 'ADVANCE', fromStepIndex: 0 })
    expect(finished.getSnapshot().value).toBe('completed')
    finished.send({ type: 'START', runId: 'run-3', stepCount: 1 })
    expect(finished.getSnapshot().value).toBe('running')
    expect(finished.getSnapshot().context.stepIndex).toBe(0)
    finished.stop()
  })

  it('restarts mid-run without carrying the old cursor', () => {
    const actor = startedRun(5)
    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    actor.send({ type: 'ADVANCE', fromStepIndex: 1 })
    actor.send({ type: 'START', runId: 'run-again', stepCount: 5 })
    expect(actor.getSnapshot().context.stepIndex).toBe(0)
    expect(actor.getSnapshot().context.runId).toBe('run-again')
    actor.stop()
  })

  it('keeps context to JSON-serializable control state for the whole lifecycle', () => {
    expect(JSON.parse(JSON.stringify(initialSequenceRunSnapshot))).toEqual(
      initialSequenceRunSnapshot,
    )

    const actor = startedRun(2)
    actor.send({ type: 'ADVANCE', fromStepIndex: 0 })
    actor.send({ type: 'ADVANCE', fromStepIndex: 1 })
    const snapshot: SequenceRunSnapshot = actor.getSnapshot().context
    // The script, the rects and the registry live outside the machine — if any of them ever leaked
    // into context, this is where a function or a Map would stop round-tripping.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.keys(snapshot).sort()).toEqual(['outcome', 'runId', 'stepCount', 'stepIndex'])
    actor.stop()
  })
})
