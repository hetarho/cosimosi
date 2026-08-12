import { describe, expect, it } from 'vitest'

import { clampChromaToGamut, isInGamut, maxChromaInGamut, relativeLuminance } from './gamut.ts'
import { EMOTION_LIGHTNESS_STEPS } from './mood-color.ts'
import { colorToOkLch } from './oklab.ts'
import { defaultMoodPalette } from './palette.ts'
import { MOODS } from './mood.ts'

describe('maxChromaInGamut', () => {
  it.each(EMOTION_LIGHTNESS_STEPS)('finds a boundary that holds at step %s', (step) => {
    for (let hue = 0; hue < 360; hue += 15) {
      const ceiling = maxChromaInGamut(step, hue)

      expect(ceiling).toBeGreaterThan(0)
      expect(isInGamut({ l: step, c: ceiling, h: hue })).toBe(true)
      expect(isInGamut({ l: step, c: ceiling + 0.01, h: hue })).toBe(false)
    }
  })

  it.each(MOODS)('leaves the authored colour for %s inside the boundary', (mood) => {
    const lch = colorToOkLch(defaultMoodPalette.colors[mood])

    expect(lch.c).toBeLessThanOrEqual(maxChromaInGamut(lch.l, lch.h))
  })

  it('pulls an unreachable chroma back to the boundary and leaves a reachable one alone', () => {
    const reachable = { l: 0.72, c: 0.05, h: 200 }
    expect(clampChromaToGamut(reachable)).toEqual(reachable)

    const clamped = clampChromaToGamut({ l: 0.8, c: 0.4, h: 90 })
    expect(clamped.c).toBeLessThan(0.4)
    expect(isInGamut(clamped)).toBe(true)
  })
})

describe('relativeLuminance', () => {
  it('reads emitted light, not perceptual lightness', () => {
    // Both sit on the same OkLCH step, so they are equally light to the eye — and half again apart
    // in the light they actually put on screen. That gap is the whole reason the risk bands read
    // luminance instead of the step.
    const yellow = relativeLuminance(defaultMoodPalette.colors.JOY)
    const crimson = relativeLuminance(defaultMoodPalette.colors.ANGER)

    expect(yellow).toBeGreaterThan(crimson * 2)
  })

  it('puts black at zero and white at one', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})
