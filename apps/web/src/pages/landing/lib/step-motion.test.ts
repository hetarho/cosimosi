import { describe, expect, it } from 'vitest'

import { tokens } from '@cosimosi/ui'

import { CAPTION_MOTION, STAGE_MOTION, sceneMotion, wordFadeMotion } from './step-motion.ts'

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

  it('wipes the caption word by word, in reading order, with opacity alone', () => {
    const first = wordFadeMotion(0, 10)
    const mid = wordFadeMotion(5, 10)
    const last = wordFadeMotion(9, 10)
    expect(Number(timing(first).delay)).toBe(0)
    expect(Number(timing(mid).delay)).toBeGreaterThan(0)
    expect(Number(timing(last).delay)).toBeGreaterThan(Number(timing(mid).delay))
    // Pure opacity — a word that travelled would smear the line the wipe is drawing.
    for (const motion of [first, last]) {
      expect(Object.keys(motion.initial as object)).toEqual(['opacity'])
      expect(Object.keys(motion.exit as object)).toEqual(['opacity'])
    }
    // A one-word caption has nothing to spread across.
    expect(Number(timing(wordFadeMotion(0, 1)).delay)).toBe(0)
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
