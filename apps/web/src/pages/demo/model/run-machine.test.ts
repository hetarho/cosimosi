import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { DEMO_BEAT_IDS } from '@cosimosi/demo'

import type { DemoAnchor } from './anchors.ts'
import { DEMO_SCRIPT } from './script.ts'
import {
  demoRunMachine,
  demoRunPhase,
  isDemoAnchorInteractive,
  syncDemoRunMachine,
} from './run-machine.ts'

const EVERY_ANCHOR: readonly DemoAnchor[] = [
  'diary-card',
  'write-action',
  'split-action',
  'launch-action',
  'time-day-action',
  'time-week-action',
  'time-month-action',
  'recall-action',
  'entry-open-action',
  'decorate-action',
]

function interactiveSet(phase: ReturnType<typeof demoRunPhase>): readonly DemoAnchor[] {
  return EVERY_ANCHOR.filter((anchor) => isDemoAnchorInteractive(phase, anchor))
}

describe('the demo run machine', () => {
  it('walks the script in order and lands in free play after the last beat', () => {
    const actor = createActor(demoRunMachine).start()

    for (const beat of DEMO_BEAT_IDS) {
      expect(demoRunPhase(actor.getSnapshot().value)).toEqual({ kind: 'tutorial', beatId: beat })
      actor.send({ type: 'NEXT' })
    }
    expect(demoRunPhase(actor.getSnapshot().value)).toEqual({ kind: 'freePlay' })
  })

  // The gating table, walked beat by beat — the availability the chrome derives and nothing else.
  it('opens exactly the current beat’s controls at each step', () => {
    const expected: Readonly<Record<string, readonly DemoAnchor[]>> = {
      diary_appears: ['diary-card'],
      split: ['split-action'],
      launch: ['launch-action'],
      // Drawing is only the flow's first press: the split and launch that finish the drawn diary
      // are the neuron-reuse beat's own work, so the whole flow stays pressable.
      neuron_reuse: ['write-action', 'split-action', 'launch-action'],
      time_accelerates: ['time-month-action'],
      recall: ['recall-action'],
      gist_rise: ['time-month-action'],
      color: [],
      ornament_taster: ['decorate-action'],
      // The closing beat is a valediction over an OPEN room: gating everything but the CTA here
      // would funnel the visitor out of the page the moment the tour ends.
      signup_cta: EVERY_ANCHOR,
    }

    const actor = createActor(demoRunMachine).start()
    for (const beat of DEMO_BEAT_IDS) {
      const phase = demoRunPhase(actor.getSnapshot().value)
      expect([...interactiveSet(phase)].sort()).toEqual([...expected[beat]].sort())
      actor.send({ type: 'NEXT' })
    }
  })

  it('keeps every step’s highlighted anchor inside its own gate', () => {
    // The script's anchor is what the tour points at; the machine's table is what stays pressable.
    // The pointed-at control being gated off would be the one unforgivable disagreement.
    const actor = createActor(demoRunMachine).start()
    for (const step of DEMO_SCRIPT.steps) {
      const phase = demoRunPhase(actor.getSnapshot().value)
      if (step.anchor) expect(isDemoAnchorInteractive(phase, step.anchor)).toBe(true)
      actor.send({ type: 'NEXT' })
    }
  })

  it('lands in free play from ANY step on skip, permanently', () => {
    DEMO_BEAT_IDS.forEach((_, stepIndex) => {
      const actor = createActor(demoRunMachine).start()
      for (let advance = 0; advance < stepIndex; advance += 1) actor.send({ type: 'NEXT' })

      actor.send({ type: 'SKIP' })
      expect(demoRunPhase(actor.getSnapshot().value)).toEqual({ kind: 'freePlay' })

      // Permanent: no event leads back out, so "all controls interactive" cannot regress.
      actor.send({ type: 'NEXT' })
      actor.send({ type: 'SKIP' })
      const phase = demoRunPhase(actor.getSnapshot().value)
      expect(phase).toEqual({ kind: 'freePlay' })
      expect(interactiveSet(phase)).toEqual(EVERY_ANCHOR)
    })
  })

  it('narrows per-memory controls to the beat’s own memory during the tutorial only', () => {
    const actor = createActor(demoRunMachine).start()
    for (let advance = 0; advance < DEMO_BEAT_IDS.indexOf('recall'); advance += 1)
      actor.send({ type: 'NEXT' })
    const recallPhase = demoRunPhase(actor.getSnapshot().value)

    expect(isDemoAnchorInteractive(recallPhase, 'recall-action', true)).toBe(true)
    expect(isDemoAnchorInteractive(recallPhase, 'recall-action', false)).toBe(false)

    actor.send({ type: 'SKIP' })
    const freePhase = demoRunPhase(actor.getSnapshot().value)
    expect(isDemoAnchorInteractive(freePhase, 'recall-action', false)).toBe(true)
  })

  it('follows the engine through advances, skip and completion', () => {
    const advanced = createActor(demoRunMachine).start()
    syncDemoRunMachine(advanced, { stepIndex: 4, outcome: null })
    expect(demoRunPhase(advanced.getSnapshot().value)).toEqual({
      kind: 'tutorial',
      beatId: DEMO_BEAT_IDS[4],
    })
    // Idempotent: re-reporting the same engine snapshot moves nothing.
    syncDemoRunMachine(advanced, { stepIndex: 4, outcome: null })
    expect(demoRunPhase(advanced.getSnapshot().value)).toEqual({
      kind: 'tutorial',
      beatId: DEMO_BEAT_IDS[4],
    })

    const skipped = createActor(demoRunMachine).start()
    syncDemoRunMachine(skipped, { stepIndex: 2, outcome: 'skipped' })
    expect(demoRunPhase(skipped.getSnapshot().value)).toEqual({ kind: 'freePlay' })

    const completed = createActor(demoRunMachine).start()
    syncDemoRunMachine(completed, { stepIndex: DEMO_BEAT_IDS.length - 1, outcome: 'completed' })
    expect(demoRunPhase(completed.getSnapshot().value)).toEqual({ kind: 'freePlay' })
  })
})
