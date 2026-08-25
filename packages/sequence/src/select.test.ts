import { describe, expect, it } from 'vitest'

import { defineScript } from './script.ts'
import { initialSequenceRunSnapshot } from './sequence.machine.ts'
import { currentStep, isActive, progress } from './select.ts'

type Anchor = 'write' | 'recall'
type Signal = 'wrote' | 'recalled'

const script = defineScript<Anchor, Signal>({
  id: 'test',
  steps: [
    {
      id: 'a',
      caption: () => 'first',
      anchor: 'write',
      advance: { on: 'signal', signal: 'wrote' },
    },
    { id: 'b', caption: () => 'second', advance: { on: 'dwell' } },
    {
      id: 'c',
      caption: () => 'third',
      anchor: 'recall',
      advance: { on: 'signal', signal: 'recalled' },
    },
  ],
})

describe('sequence selectors', () => {
  it('joins the snapshot cursor to the script the machine never holds', () => {
    expect(currentStep(script, { ...initialSequenceRunSnapshot, stepIndex: 1 })?.id).toBe('b')
    // Past the end is null rather than a throw: a completed run still renders one last frame.
    expect(currentStep(script, { ...initialSequenceRunSnapshot, stepIndex: 3 })).toBeNull()
  })

  it('reads progress one-based and never past the total', () => {
    expect(progress({ ...initialSequenceRunSnapshot, stepIndex: 0, stepCount: 3 })).toEqual({
      current: 1,
      total: 3,
    })
    expect(progress({ ...initialSequenceRunSnapshot, stepIndex: 5, stepCount: 3 })).toEqual({
      current: 3,
      total: 3,
    })
    expect(progress(initialSequenceRunSnapshot)).toEqual({ current: 0, total: 0 })
  })

  it('is active only between a start and an outcome', () => {
    expect(isActive(initialSequenceRunSnapshot)).toBe(false)
    expect(isActive({ ...initialSequenceRunSnapshot, runId: 'r' })).toBe(true)
    expect(isActive({ ...initialSequenceRunSnapshot, runId: 'r', outcome: 'skipped' })).toBe(false)
  })
})
