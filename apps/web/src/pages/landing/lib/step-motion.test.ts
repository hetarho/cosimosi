import { describe, expect, it } from 'vitest'

import { tokens } from '@cosimosi/ui'

import { CAPTION_MOTION, STAGE_MOTION, sceneMotion } from './step-motion.ts'

// The choreography's whole claim is that the page moves at the PRODUCT's pace — the same durations and
// the same curve every CSS transition uses. Both parsers fall back silently when handed something they
// cannot read, which is the right runtime behaviour and exactly why it needs a test: a fallback nobody
// asserts against is a page that quietly stops following the tokens.
const timing = (motion: typeof STAGE_MOTION) => motion.transition as Record<string, unknown>

describe('the step choreography', () => {
  it('takes its durations from the tokens, converted to Motion seconds', () => {
    expect(timing(STAGE_MOTION).duration).toBe(Number.parseFloat(tokens.duration.base) / 1000)
    expect(timing(CAPTION_MOTION).duration).toBe(Number.parseFloat(tokens.duration.fast) / 1000)
    // The caption is quicker than the stage, or the words read as a page change rather than a caption.
    expect(timing(CAPTION_MOTION).duration).toBeLessThan(Number(timing(STAGE_MOTION).duration))
  })

  it('reads the standard curve as the token’s own numbers, not the named fallback', () => {
    const ease = timing(STAGE_MOTION).ease
    expect(Array.isArray(ease)).toBe(true)
    const numbers = ease as number[]
    expect(numbers).toHaveLength(4)
    // Asserted against the token text rather than a copy of the four numbers, so this stays true when
    // the curve is retuned and false the moment the parse gives up.
    for (const value of numbers) expect(tokens.ease.standard).toContain(String(value))
  })

  it('staggers the split scenes in the order the day was written', () => {
    const delays = [0, 1, 2].map((index) => Number(timing(sceneMotion(index)).delay))
    expect(delays[0]).toBe(0)
    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(delays[2]).toBeGreaterThan(delays[1])
    // All three are in place inside one stage swap — a split that trailed past it would read as a
    // second transition rather than as the day coming apart.
    expect(delays[2]).toBeLessThan(Number(timing(STAGE_MOTION).duration))
  })
})
