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
      const [lightness] = oklab(defaultMoodPalette.colors[mood])
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
        const first = oklab(defaultMoodPalette.colors[MOODS[i]])
        const second = oklab(defaultMoodPalette.colors[MOODS[j]])
        const distance = Math.hypot(
          first[0] - second[0],
          first[1] - second[1],
          first[2] - second[2],
        )
        expect(distance, `${MOODS[i]} and ${MOODS[j]} read as one colour`).toBeGreaterThanOrEqual(
          MIN_SEPARATION,
        )
      }
    }
  })
})

// sRGB hex → OkLab (L, a, b) — the space the palette is authored in, so the guards above measure
// what the design decided rather than a gamma-encoded approximation of it.
function oklab(color: Color): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function colorTable(color: Color): Record<Mood, Color> {
  return Object.fromEntries(MOODS.map((mood) => [mood, color])) as Record<Mood, Color>
}
