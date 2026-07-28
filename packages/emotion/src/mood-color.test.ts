import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { MOODS } from './mood.ts'
import {
  EMOTION_LIGHTNESS_STEPS,
  nearDuplicateMood,
  resolveMoodColors,
  snapToEmotionStep,
} from './mood-color.ts'
import { colorToOkLch } from './oklab.ts'
import { defaultMoodPalette } from './palette.ts'

describe('per-mood colors', () => {
  it('snaps lightness while preserving hue and chroma within 8-bit encoding tolerance', () => {
    const before = colorToOkLch('#bb44aa')
    const after = colorToOkLch(snapToEmotionStep('#bb44aa'))

    expect(EMOTION_LIGHTNESS_STEPS.some((step) => Math.abs(after.l - step) < 0.005)).toBe(true)
    expect(after.c).toBeCloseTo(before.c, 2)
    expect(after.h).toBeCloseTo(before.h, 0)
  })

  it('reports a near duplicate without rejecting or changing the candidate', () => {
    const candidate = defaultMoodPalette.colors.JOY
    const found = nearDuplicateMood(candidate, {
      CALM: candidate,
      SAD: defaultMoodPalette.colors.SAD,
    })

    expect(VALUES.palette.similarDeltaEMin).toBeGreaterThan(0)
    expect(found).toBe('CALM')
    expect(candidate).toBe(defaultMoodPalette.colors.JOY)
  })

  it('overlays partial rows on the authored default', () => {
    const palette = resolveMoodColors([{ mood: 'JOY', color: '#abcdef' }])

    expect(palette.colors.JOY).toBe('#abcdef')
    expect(palette.colors.CALM).toBe(defaultMoodPalette.colors.CALM)
    expect(Object.keys(palette.colors)).toHaveLength(MOODS.length)
  })
})
