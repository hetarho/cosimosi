import { describe, expect, it } from 'vitest'
import {
  MOOD_AFFECT,
  MOOD_LABEL,
  MOOD_PALETTE,
  MOODS as CANONICAL_MOODS,
  MOODS_BY_QUADRANT,
  isMood,
  moodLabel,
  moodRgb,
  NEUTRAL_RGB,
  parseMood,
  type Mood,
} from './mood'

// The canonical 13 (spec 29): 4 affective quadrants ×3 + neutral.
const EXPECTED_MOODS: Mood[] = [
  'joy',
  'calm',
  'sad',
  'anger',
  'fear',
  'love',
  'neutral',
  'excitement',
  'gratitude',
  'relief',
  'stress',
  'tired',
  'emptiness',
]

describe('mood taxonomy (spec 29 — 13 moods)', () => {
  it('palette/label/affect key exactly the 13 moods (1.3)', () => {
    const sorted = [...EXPECTED_MOODS].sort()
    expect(Object.keys(MOOD_PALETTE).sort()).toEqual(sorted)
    expect(Object.keys(MOOD_LABEL).sort()).toEqual(sorted)
    expect(Object.keys(MOOD_AFFECT).sort()).toEqual(sorted)
    expect([...CANONICAL_MOODS].sort()).toEqual(sorted)
    expect([...MOODS_BY_QUADRANT].sort()).toEqual(sorted)
  })

  it('keeps the original 7 colors byte-for-byte (1.4 backward-compat)', () => {
    expect(MOOD_PALETTE.joy).toEqual([1.0, 0.84, 0.3])
    expect(MOOD_PALETTE.calm).toEqual([0.4, 0.75, 0.85])
    expect(MOOD_PALETTE.sad).toEqual([0.35, 0.45, 0.72])
    expect(MOOD_PALETTE.anger).toEqual([0.92, 0.28, 0.28])
    expect(MOOD_PALETTE.fear).toEqual([0.55, 0.35, 0.78])
    expect(MOOD_PALETTE.love).toEqual([0.96, 0.5, 0.72])
    expect(MOOD_PALETTE.neutral).toEqual([0.6, 0.6, 0.6])
  })

  it('keeps the original 7 labels (1.4)', () => {
    expect(MOOD_LABEL.joy).toBe('기쁨')
    expect(MOOD_LABEL.calm).toBe('평온')
    expect(MOOD_LABEL.sad).toBe('슬픔')
    expect(MOOD_LABEL.anger).toBe('분노')
    expect(MOOD_LABEL.fear).toBe('두려움')
    expect(MOOD_LABEL.love).toBe('사랑')
    expect(MOOD_LABEL.neutral).toBe('중립')
  })

  it('every mood has a label and an in-gamut linear-RGB color', () => {
    for (const m of EXPECTED_MOODS) {
      expect(MOOD_LABEL[m]).toBeTruthy()
      const rgb = MOOD_PALETTE[m]
      expect(rgb).toHaveLength(3)
      for (const c of rgb) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(1)
      }
    }
  })

  it('places each mood in a valid quadrant with in-range coords (1.5)', () => {
    const quadrants = new Set(['HAP', 'LAP', 'HAN', 'LAN', 'center'])
    for (const m of EXPECTED_MOODS) {
      const a = MOOD_AFFECT[m]
      expect(quadrants.has(a.quadrant)).toBe(true)
      expect(a.arousal).toBeGreaterThanOrEqual(0)
      expect(a.arousal).toBeLessThanOrEqual(1)
      expect(a.valence).toBeGreaterThanOrEqual(-1)
      expect(a.valence).toBeLessThanOrEqual(1)
    }
  })

  it('fills the previously-empty low-arousal-negative quadrant (spec 29 raison d’être)', () => {
    expect(MOOD_AFFECT.tired.quadrant).toBe('LAN')
    expect(MOOD_AFFECT.emptiness.quadrant).toBe('LAN')
    expect(MOOD_AFFECT.neutral).toEqual({ quadrant: 'center', arousal: 0, valence: 0 })
  })

  it('keeps quadrant↔valence signs coherent', () => {
    for (const m of EXPECTED_MOODS) {
      const a = MOOD_AFFECT[m]
      if (a.quadrant === 'HAP' || a.quadrant === 'LAP') expect(a.valence).toBeGreaterThan(0)
      if (a.quadrant === 'HAN' || a.quadrant === 'LAN') expect(a.valence).toBeLessThan(0)
      if (a.quadrant === 'center') expect(a.valence).toBe(0)
    }
  })

  it('moodRgb/moodLabel fall back to neutral on unknown strings (never throw)', () => {
    expect(moodRgb('nope')).toEqual(NEUTRAL_RGB)
    expect(moodRgb('tired')).toEqual(MOOD_PALETTE.tired)
    expect(moodLabel('nope')).toBe('중립')
    expect(moodLabel('stress')).toBe('스트레스')
  })

  it('parseMood/isMood narrow known strings and fall back to neutral', () => {
    expect(isMood('gratitude')).toBe(true)
    expect(isMood('mystery')).toBe(false)
    expect(parseMood('gratitude')).toBe('gratitude')
    expect(parseMood('mystery')).toBe('neutral')
    expect(parseMood(null)).toBe('neutral')
  })
})
