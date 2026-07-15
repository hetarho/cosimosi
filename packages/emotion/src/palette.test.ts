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

function colorTable(color: Color): Record<Mood, Color> {
  return Object.fromEntries(MOODS.map((mood) => [mood, color])) as Record<Mood, Color>
}
