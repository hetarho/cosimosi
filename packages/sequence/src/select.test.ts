import { describe, expect, it } from 'vitest'

import { defineScript } from './script.ts'
import { initialSequenceRunSnapshot } from './sequence.machine.ts'
import {
  currentStep,
  isActive,
  progress,
  resolveCaptionPlacement,
  resolveCenteredCaptionPlacement,
} from './select.ts'

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

const VIEWPORT = { width: 400, height: 800 }
const BAND = 96

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

  it('moves the caption only when the highlighted control is under it', () => {
    // A control up the page: the caption stays where the reader expects it.
    expect(resolveCaptionPlacement({ x: 0, y: 100, width: 200, height: 40 }, VIEWPORT, BAND)).toBe(
      'bottom',
    )
    // The bottom-center writing sheet — exactly the collision the rule exists for.
    expect(resolveCaptionPlacement({ x: 0, y: 720, width: 400, height: 80 }, VIEWPORT, BAND)).toBe(
      'top',
    )
    // Ending exactly at the band's top edge is not yet an overlap.
    expect(resolveCaptionPlacement({ x: 0, y: 604, width: 400, height: 100 }, VIEWPORT, BAND)).toBe(
      'bottom',
    )
    // No anchor at all, and a rect entirely below the viewport, both leave it alone.
    expect(resolveCaptionPlacement(null, VIEWPORT, BAND)).toBe('bottom')
    expect(resolveCaptionPlacement({ x: 0, y: 900, width: 10, height: 10 }, VIEWPORT, BAND)).toBe(
      'bottom',
    )
  })

  it('floats the opted-in caption at the lower third except over a crossing control', () => {
    // A control along the top edge leaves the floating band free.
    expect(
      resolveCenteredCaptionPlacement({ x: 0, y: 40, width: 200, height: 40 }, VIEWPORT, BAND),
    ).toBe('center')
    // No anchor (a narration-only step) floats too.
    expect(resolveCenteredCaptionPlacement(null, VIEWPORT, BAND)).toBe('center')
    // A centered dialog reaches into the floating band: the caption yields to the edge resolution
    // rather than sitting on the very control it describes.
    expect(
      resolveCenteredCaptionPlacement({ x: 200, y: 300, width: 400, height: 200 }, VIEWPORT, BAND),
    ).toBe('bottom')
    // A mid-crossing control that ALSO owns the bottom band pushes it to the top.
    expect(
      resolveCenteredCaptionPlacement({ x: 200, y: 300, width: 400, height: 450 }, VIEWPORT, BAND),
    ).toBe('top')
  })
})
