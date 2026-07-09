import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { createEmotion } from './emotion.ts'
import { MOODS, moodCoordinate, moodQuadrant, moodValueKeys } from './mood.ts'

describe('mood coordinates', () => {
  it('keeps the 13 mood enum aligned with generated values maps', () => {
    expect(MOODS).toHaveLength(13)
    expect(new Set(MOODS).size).toBe(13)
    expect(Object.values(moodValueKeys).sort()).toEqual(
      Object.keys(VALUES.emotion.moodValence).sort(),
    )
    expect(Object.values(moodValueKeys).sort()).toEqual(
      Object.keys(VALUES.emotion.moodArousal).sort(),
    )
  })

  it('reads mood coordinates from generated values', () => {
    const joy = moodCoordinate('JOY')

    expect(joy).toEqual({
      valence: VALUES.emotion.moodValence.joy,
      arousal: VALUES.emotion.moodArousal.joy,
    })
  })

  it('keeps recorded coordinates inside their quadrant signs', () => {
    for (const mood of MOODS) {
      const coordinate = moodCoordinate(mood)
      switch (moodQuadrant(mood)) {
        case 'positive_high_arousal':
          expect(coordinate.valence).toBeGreaterThan(0)
          expect(coordinate.arousal).toBeGreaterThan(0.5)
          break
        case 'positive_low_arousal':
          expect(coordinate.valence).toBeGreaterThan(0)
          expect(coordinate.arousal).toBeLessThan(0.5)
          break
        case 'negative_high_arousal':
          expect(coordinate.valence).toBeLessThan(0)
          expect(coordinate.arousal).toBeGreaterThan(0.5)
          break
        case 'negative_low_arousal':
          expect(coordinate.valence).toBeLessThan(0)
          expect(coordinate.arousal).toBeLessThan(0.5)
          break
        case 'neutral':
          expect(coordinate.valence).toBe(0)
          expect(coordinate.arousal).toBeGreaterThanOrEqual(0)
          expect(coordinate.arousal).toBeLessThanOrEqual(1)
          break
      }
    }
  })

  it('creates an Emotion mirror from a mood coordinate and default intensity', () => {
    expect(createEmotion('RELIEF')).toEqual({
      mood: 'RELIEF',
      valence: VALUES.emotion.moodValence.relief,
      arousal: VALUES.emotion.moodArousal.relief,
      intensity: VALUES.emotion.defaultIntensity,
    })
  })
})
