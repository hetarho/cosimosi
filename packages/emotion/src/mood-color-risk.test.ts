import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { relativeLuminance } from './gamut.ts'
import { moodColorRisks, type MoodColorRisk } from './mood-color-risk.ts'
import { ALTERNATIVE_MOOD_COLORS } from './alternative-mood-colors.ts'
import { MOODS } from './mood.ts'
import { okLchToColor } from './oklab.ts'
import { defaultMoodPalette } from './palette.ts'

// The concerns carry a mood for the relational one, so every assertion here reads the risk names.
const risksOf = (concerns: ReturnType<typeof moodColorRisks>): MoodColorRisk[] =>
  concerns.map((concern) => concern.risk)

describe('moodColorRisks', () => {
  it.each(MOODS)('never argues with the authored colour for %s', (mood) => {
    expect(risksOf(moodColorRisks(mood, defaultMoodPalette.colors[mood]))).toEqual([])
  })

  // The alternative table is the other shipped set of emotion colours: if a colour we recommend
  // ourselves tripped a warning, the bands would be wrong rather than the colour.
  it.each(MOODS)('leaves the alternative colour for %s unflagged', (mood) => {
    expect(risksOf(moodColorRisks(mood, ALTERNATIVE_MOOD_COLORS[mood]))).toEqual([])
  })

  it('flags the brightest reachable colour as glare', () => {
    // Top lightness step, the yellow-green arc, more chroma than any authored entry carries.
    const color = okLchToColor({ l: 0.8, c: 0.27, h: 143 })

    expect(relativeLuminance(color)).toBeGreaterThanOrEqual(VALUES.palette.glareLuminanceMax)
    expect(risksOf(moodColorRisks('JOY', color))).toContain('GLARE')
  })

  it('flags the deepest reachable colour as dim', () => {
    // Bottom lightness step, the violet-magenta arc, at the chroma where the least light comes back.
    const color = okLchToColor({ l: 0.63, c: 0.31, h: 318 })

    expect(relativeLuminance(color)).toBeLessThanOrEqual(VALUES.palette.dimLuminanceMin)
    expect(risksOf(moodColorRisks('JOY', color))).toContain('DIM')
  })

  it('flags a colour that has stopped being a hue as faint', () => {
    const color = okLchToColor({ l: 0.72, c: VALUES.palette.nearNeutralChromaMax / 2, h: 200 })

    expect(risksOf(moodColorRisks('JOY', color))).toEqual(['FAINT'])
  })

  it('leaves grey alone for the feeling whose authored colour is already grey', () => {
    const color = okLchToColor({ l: 0.72, c: VALUES.palette.nearNeutralChromaMax / 2, h: 200 })

    expect(risksOf(moodColorRisks('NEUTRAL', color))).toEqual([])
  })

  it('warns while choosing when another feeling already wears this colour, and names it', () => {
    // The relational concern: raised HERE beside the rest rather than reported after the save, so a
    // reader learns two feelings will be hard to tell apart while they can still pick another.
    const taken = defaultMoodPalette.colors.SAD
    const concerns = moodColorRisks('JOY', taken, defaultMoodPalette.colors)

    expect(concerns).toEqual([{ risk: 'SIMILAR', otherMood: 'SAD' }])
  })

  it('never calls a colour too close to the one it is replacing', () => {
    // The edited mood is in the table it is compared against, and must be skipped: re-picking the
    // colour a feeling already wears is not a collision with anything.
    expect(
      risksOf(moodColorRisks('JOY', defaultMoodPalette.colors.JOY, defaultMoodPalette.colors)),
    ).toEqual([])
  })

  it('says both things at once when a colour is faint AND already taken', () => {
    const grey = okLchToColor({ l: 0.72, c: VALUES.palette.nearNeutralChromaMax / 2, h: 200 })
    const concerns = risksOf(moodColorRisks('JOY', grey, { CALM: grey }))

    expect(concerns).toEqual(['FAINT', 'SIMILAR'])
  })
})
