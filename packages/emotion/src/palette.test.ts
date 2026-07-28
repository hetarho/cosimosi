import { afterEach, describe, expect, it } from 'vitest'

import {
  defaultMoodPalette,
  defineMoodPalette,
  moodColor,
  paletteVersion,
  resetMoodPalette,
  setMoodPalette,
  subscribeMoodPalette,
  type Color,
  type MoodPalette,
} from './palette.ts'
import { MOODS, type Mood } from './mood.ts'
import { colorToOkLab, deltaEOkLab } from './oklab.ts'

describe('mood palette seam', () => {
  afterEach(() => {
    resetMoodPalette()
  })

  it('maps every mood through the single default palette entry point', () => {
    const colors = MOODS.map((mood) => moodColor(mood))

    expect(colors).toHaveLength(13)
    expect(new Set(colors).size).toBe(13)
    expect(moodColor('JOY')).toBe(defaultMoodPalette.colors.JOY)
  })

  it('lets a substitute palette recolor consumers that call moodColor', () => {
    const substitute = defineMoodPalette('test-palette', colorTable('#123456'))

    setMoodPalette(substitute)

    expect(moodColor('JOY')).toBe('#123456')
    expect(moodColor('FEAR')).toBe('#123456')
  })

  it('rejects incomplete palette tables at the seam', () => {
    const partial = {
      name: 'partial',
      colors: { JOY: '#ffffff' },
    } as unknown as MoodPalette

    expect(() => setMoodPalette(partial)).toThrow(/missing CALM/)
  })

  it('advances the palette version and notifies subscribers on a swap', () => {
    const substitute = defineMoodPalette('version-probe', colorTable('#abcdef'))
    let notifications = 0
    const unsubscribe = subscribeMoodPalette(() => {
      notifications += 1
    })
    const before = paletteVersion()

    setMoodPalette(substitute)
    expect(paletteVersion()).toBe(before + 1)
    expect(notifications).toBe(1)

    resetMoodPalette()
    expect(paletteVersion()).toBe(before + 2)
    expect(notifications).toBe(2)

    unsubscribe()
    setMoodPalette(substitute)
    expect(notifications).toBe(2)
  })
})

// The two invariants the default palette is designed around (see palette.ts). They hold for the
// default only — a registry alternative is bound by the axis guardrail, not by this design.
describe('default palette design invariants', () => {
  // The 2D language's shared lightness scale (packages/ui/src/palette.ts): steps 300 / 400 / 500.
  const STEPS = [0.8, 0.72, 0.63]
  // 8-bit rounding is the only deviation an authored step may carry.
  const STEP_TOLERANCE = 0.005
  const MIN_SEPARATION = 0.05

  it('places every mood on one step of the shared lightness scale', () => {
    for (const mood of MOODS) {
      const { l: lightness } = colorToOkLab(defaultMoodPalette.colors[mood])
      const deviation = Math.min(...STEPS.map((step) => Math.abs(lightness - step)))
      expect(
        deviation,
        `${mood} sits off the lightness scale (L ${lightness.toFixed(4)})`,
      ).toBeLessThan(STEP_TOLERANCE)
    }
  })

  it('keeps every pair of moods perceptually apart', () => {
    for (let i = 0; i < MOODS.length; i += 1) {
      for (let j = i + 1; j < MOODS.length; j += 1) {
        const distance = deltaEOkLab(
          defaultMoodPalette.colors[MOODS[i]],
          defaultMoodPalette.colors[MOODS[j]],
        )
        expect(distance, `${MOODS[i]} and ${MOODS[j]} read as one colour`).toBeGreaterThanOrEqual(
          MIN_SEPARATION,
        )
      }
    }
  })
})

function colorTable(color: Color): Record<Mood, Color> {
  return Object.fromEntries(MOODS.map((mood) => [mood, color])) as Record<Mood, Color>
}
