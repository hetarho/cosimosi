import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { relativeLuminance } from './gamut.ts'
import { moodColorRisks } from './mood-color-risk.ts'
import { ALTERNATIVE_MOOD_COLORS } from './alternative-mood-colors.ts'
import { MOODS } from './mood.ts'
import { okLchToColor } from './oklab.ts'
import { defaultMoodPalette } from './palette.ts'

describe('moodColorRisks', () => {
  it.each(MOODS)('never argues with the authored colour for %s', (mood) => {
    expect(moodColorRisks(mood, defaultMoodPalette.colors[mood])).toEqual([])
  })

  // The alternative table is the other shipped set of emotion colours: if a colour we recommend
  // ourselves tripped a warning, the bands would be wrong rather than the colour.
  it.each(MOODS)('leaves the alternative colour for %s unflagged', (mood) => {
    expect(moodColorRisks(mood, ALTERNATIVE_MOOD_COLORS[mood])).toEqual([])
  })

  it('flags the brightest reachable colour as glare', () => {
    // Top lightness step, the yellow-green arc, more chroma than any authored entry carries.
    const color = okLchToColor({ l: 0.8, c: 0.27, h: 143 })

    expect(relativeLuminance(color)).toBeGreaterThanOrEqual(VALUES.palette.glareLuminanceMax)
    expect(moodColorRisks('JOY', color)).toContain('GLARE')
  })

  it('flags the deepest reachable colour as dim', () => {
    // Bottom lightness step, the violet-magenta arc, at the chroma where the least light comes back.
    const color = okLchToColor({ l: 0.63, c: 0.31, h: 318 })

    expect(relativeLuminance(color)).toBeLessThanOrEqual(VALUES.palette.dimLuminanceMin)
    expect(moodColorRisks('JOY', color)).toContain('DIM')
  })

  it('flags a colour that has stopped being a hue as faint', () => {
    const color = okLchToColor({ l: 0.72, c: VALUES.palette.nearNeutralChromaMax / 2, h: 200 })

    expect(moodColorRisks('JOY', color)).toEqual(['FAINT'])
  })

  it('leaves grey alone for the feeling whose authored colour is already grey', () => {
    const color = okLchToColor({ l: 0.72, c: VALUES.palette.nearNeutralChromaMax / 2, h: 200 })

    expect(moodColorRisks('NEUTRAL', color)).toEqual([])
  })
})
