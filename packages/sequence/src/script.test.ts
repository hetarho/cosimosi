import { describe, expect, it } from 'vitest'

import { defineScript, type SequenceStep } from './script.ts'

type Anchor = 'write-diary' | 'accelerate-time'
type Signal = 'diary_launched' | 'clock_advanced'

describe('the step model', () => {
  it('passes a script through untouched — the guarantees are types, not runtime checks', () => {
    const steps: readonly SequenceStep<Anchor, Signal>[] = [
      {
        id: 'write',
        caption: () => 'Write one line.',
        anchor: 'write-diary',
        advance: { on: 'signal', signal: 'diary_launched' },
      },
      { id: 'read', caption: () => 'Watch it settle.', advance: { on: 'dwell' } },
    ]
    const script = defineScript<Anchor, Signal>({ id: 'demo', steps })
    expect(script.steps).toBe(steps)
  })

  it('expresses a whole step with four fields and nothing that could act', () => {
    const step: SequenceStep<Anchor, Signal> = {
      id: 'advance',
      caption: () => 'Now move the clock forward.',
      anchor: 'accelerate-time',
      advance: { on: 'signal', signal: 'clock_advanced' },
    }
    // The compile-time guard is the closed interface; this records the resulting vocabulary so a new
    // field cannot be added without a reader noticing which absence it spends. There is no
    // action/effect (the engine must never perform the step for the user), no `skippable` (a step
    // cannot refuse the skip), no string caption (that would be unreviewed public copy), no domain
    // number (no formula can ride in a script) and no host-kind flag.
    expect(Object.keys(step).sort()).toEqual(['advance', 'anchor', 'caption', 'id'])
  })

  it('offers exactly two ways to advance', () => {
    const waits: SequenceStep<Anchor, Signal>['advance'][] = [
      { on: 'signal', signal: 'diary_launched' },
      { on: 'dwell' },
    ]
    expect(waits.map((advance) => advance.on)).toEqual(['signal', 'dwell'])
  })
})
