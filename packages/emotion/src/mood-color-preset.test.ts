import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { moodColorPresets, randomMoodColor } from './mood-color-preset.ts'
import { moodColorRisks } from './mood-color-risk.ts'
import { MOODS } from './mood.ts'
import { colorToOkLch } from './oklab.ts'
import { defaultMoodPalette } from './palette.ts'
import { EMOTION_LIGHTNESS_STEPS } from './mood-color.ts'

describe('moodColorPresets', () => {
  it.each(MOODS)('opens with the authored colour and ends with random for %s', (mood) => {
    const presets = moodColorPresets(mood, [])

    expect(presets).toEqual([
      { kind: 'AUTHORED', color: defaultMoodPalette.colors[mood] },
      { kind: 'RANDOM' },
    ])
  })

  it('ranks the popular presets in the order the aggregate handed them over', () => {
    const presets = moodColorPresets('JOY', [
      { bucket: 2, color: '#123456', share: 0.41 },
      { bucket: 5, color: '#654321', share: 0.29 },
    ])

    expect(presets).toEqual([
      { kind: 'AUTHORED', color: defaultMoodPalette.colors.JOY },
      { kind: 'POPULAR', color: '#123456', rank: 1, share: 0.41 },
      { kind: 'POPULAR', color: '#654321', rank: 2, share: 0.29 },
      { kind: 'RANDOM' },
    ])
  })

  it('carries a lone choice at its full share rather than withholding it', () => {
    const presets = moodColorPresets('JOY', [{ bucket: 2, color: '#123456', share: 1 }])

    expect(presets.filter((preset) => preset.kind === 'POPULAR')).toEqual([
      { kind: 'POPULAR', color: '#123456', rank: 1, share: 1 },
    ])
  })

  it('leaves two equal shares in the order they arrived, never re-sorting them', () => {
    const presets = moodColorPresets('JOY', [
      { bucket: 9, color: '#654321', share: 0.5 },
      { bucket: 2, color: '#123456', share: 0.5 },
    ])

    expect(
      presets.filter((preset) => preset.kind === 'POPULAR').map((preset) => preset.color),
    ).toEqual(['#654321', '#123456'])
  })

  it('drops a popular bucket that is already the authored colour rather than showing it twice', () => {
    const presets = moodColorPresets('JOY', [
      { bucket: 2, color: defaultMoodPalette.colors.JOY, share: 0.62 },
      { bucket: 5, color: '#123456', share: 0.2 },
      { bucket: 7, color: '#654321', share: 0.1 },
    ])

    expect(presets.filter((preset) => preset.kind === 'POPULAR')).toEqual([
      { kind: 'POPULAR', color: '#123456', rank: 1, share: 0.2 },
      { kind: 'POPULAR', color: '#654321', rank: 2, share: 0.1 },
    ])
    expect(
      presets.filter(
        (preset) => preset.kind !== 'RANDOM' && preset.color === defaultMoodPalette.colors.JOY,
      ),
    ).toHaveLength(1)
  })

  it('gives the authored preset the share of its own bucket and does not rank it too', () => {
    const presets = moodColorPresets('JOY', [
      { bucket: 1, color: defaultMoodPalette.colors.JOY, share: 0.7 },
      { bucket: 5, color: '#123456', share: 0.3 },
    ])

    expect(presets[0]).toEqual({
      kind: 'AUTHORED',
      color: defaultMoodPalette.colors.JOY,
      share: 0.7,
    })
    expect(presets.filter((preset) => preset.kind === 'POPULAR')).toEqual([
      { kind: 'POPULAR', color: '#123456', rank: 1, share: 0.3 },
    ])
  })

  it('leaves the authored preset shareless when the aggregate does not hold its colour', () => {
    const presets = moodColorPresets('JOY', [{ bucket: 5, color: '#123456', share: 1 }])

    expect(presets[0]).toEqual({ kind: 'AUTHORED', color: defaultMoodPalette.colors.JOY })
  })

  it('never offers more popular presets than the configured slot count', () => {
    const presets = moodColorPresets(
      'CALM',
      Array.from({ length: 6 }, (_, index) => ({
        bucket: index,
        color: `#0000${index}${index}` as const,
        share: 1 / 6,
      })),
    )

    expect(presets.filter((preset) => preset.kind === 'POPULAR')).toHaveLength(
      VALUES.palette.popularPresetCount,
    )
  })
})

describe('randomMoodColor', () => {
  it('lands on an emotion lightness step', () => {
    const color = randomMoodColor('JOY', sequence([0.4, 0.7, 0.5]))
    const lightness = colorToOkLch(color).l

    expect(EMOTION_LIGHTNESS_STEPS.some((step) => Math.abs(step - lightness) < 0.01)).toBe(true)
  })

  it('re-draws past a risky colour instead of handing it over', () => {
    // First throw: the top step at the yellow-green arc with maximum chroma — the glare band.
    // Second throw: mid step, a hue that carries no risk at any chroma.
    const color = randomMoodColor('JOY', sequence([0, 143 / 360, 1, 0.4, 0.7, 0.5]))

    expect(moodColorRisks('JOY', color)).toEqual([])
  })

  it.each(MOODS)('returns a colour for %s across a sweep of throws', (mood) => {
    for (let throwIndex = 0; throwIndex < 20; throwIndex += 1) {
      const fraction = throwIndex / 20
      const color = randomMoodColor(mood, sequence([fraction, fraction, fraction]))
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

/** A `random` that hands back the given draws in order, then repeats the last one. */
function sequence(draws: readonly number[]): () => number {
  let index = 0
  return () => draws[Math.min(index++, draws.length - 1)] ?? 0
}
