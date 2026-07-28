import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { MOODS } from '../mood.ts'

import { completeMoodColorRecommendations } from './mood-colors.ts'

describe('mood color recommendations', () => {
  it('uses aggregate candidates first and fills an honest three without inventing shares', () => {
    const recommendations = completeMoodColorRecommendations('JOY', [
      { bucket: 2, color: '#123456', share: 0.41 },
    ])

    expect(recommendations).toHaveLength(VALUES.palette.recommendationCount)
    expect(recommendations[0]).toEqual({ bucket: 2, color: '#123456', share: 0.41 })
    expect(recommendations.slice(1).every((item) => item.share === undefined)).toBe(true)
  })

  it.each(MOODS)('always returns three distinct recommendations for %s', (mood) => {
    const recommendations = completeMoodColorRecommendations(mood, [])

    expect(recommendations).toHaveLength(VALUES.palette.recommendationCount)
    expect(new Set(recommendations.map((item) => item.color)).size).toBe(
      VALUES.palette.recommendationCount,
    )
  })
})
