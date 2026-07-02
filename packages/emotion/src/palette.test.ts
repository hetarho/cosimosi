import { afterEach, describe, expect, it } from 'vitest'

import {
  defaultMoodPalette,
  defineMoodPalette,
  moodColor,
  resetMoodPalette,
  setMoodPalette,
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
})

function colorTable(color: Color): Record<Mood, Color> {
  return Object.fromEntries(MOODS.map((mood) => [mood, color])) as Record<Mood, Color>
}
