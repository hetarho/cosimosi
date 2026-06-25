import { describe, expect, it } from 'vitest'
import { MOOD_PALETTE, type Mood } from '@/shared/config'
import {
  MOOD_ORDER,
  rgbToHex,
  isHexColor,
  normalizeHex,
  recommendedEmotionColors,
  isCompleteEmotionColors,
  mergeEmotionColorDraft,
} from './emotion-colors'

const ALL_13: Mood[] = [
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

describe('MOOD_ORDER', () => {
  it('covers all 13 moods exactly once', () => {
    expect(MOOD_ORDER).toHaveLength(13)
    expect(new Set(MOOD_ORDER)).toEqual(new Set(ALL_13))
  })
})

describe('rgbToHex', () => {
  it('maps linear-RGB(0..1) to uppercase #RRGGBB and clamps', () => {
    expect(rgbToHex([0, 0, 0])).toBe('#000000')
    expect(rgbToHex([1, 1, 1])).toBe('#FFFFFF')
    expect(rgbToHex([2, -1, 0.5])).toBe('#FF0080') // clamp + round
  })
})

describe('isHexColor / normalizeHex', () => {
  it('accepts both cases, rejects bad shapes', () => {
    expect(isHexColor('#aAbBcC')).toBe(true)
    expect(isHexColor('aabbcc')).toBe(false) // no #
    expect(isHexColor('#abc')).toBe(false) // 3-digit not allowed
  })
  it('normalizes to uppercase #RRGGBB, tolerates missing # / whitespace', () => {
    expect(normalizeHex('  ffd64d ')).toBe('#FFD64D')
    expect(normalizeHex('#abcdef')).toBe('#ABCDEF')
    expect(normalizeHex('#abc')).toBeNull()
    expect(normalizeHex('nope')).toBeNull()
  })
})

describe('recommendedEmotionColors', () => {
  it('derives 13 hex colors from MOOD_PALETTE (not a hardcoded table)', () => {
    const rec = recommendedEmotionColors()
    expect(Object.keys(rec)).toHaveLength(13)
    for (const m of MOOD_ORDER) {
      expect(rec[m]).toBe(rgbToHex(MOOD_PALETTE[m]))
      expect(isHexColor(rec[m])).toBe(true)
    }
  })
})

describe('isCompleteEmotionColors', () => {
  it('true only when all 13 present and valid', () => {
    expect(isCompleteEmotionColors(recommendedEmotionColors())).toBe(true)
    expect(isCompleteEmotionColors(undefined)).toBe(false)
    expect(isCompleteEmotionColors({})).toBe(false)
  })
  it('false on a missing, malformed, or lower-case-only-missing mood', () => {
    const c = recommendedEmotionColors() as Record<string, string>
    const missing = { ...c }
    delete missing.joy
    expect(isCompleteEmotionColors(missing)).toBe(false)
    expect(isCompleteEmotionColors({ ...c, anger: '#xyzxyz' })).toBe(false)
    expect(isCompleteEmotionColors({ ...c, fear: 'abcdef' })).toBe(false) // no #
  })
  it('ignores unknown extra keys (judges only the 13)', () => {
    expect(isCompleteEmotionColors({ ...recommendedEmotionColors(), bogus: 'nope' })).toBe(true)
  })
})

describe('mergeEmotionColorDraft', () => {
  it('prefers server color, falls back to recommended, always 13 complete', () => {
    const rec = recommendedEmotionColors()
    const draft = mergeEmotionColorDraft({ joy: '#123456', anger: 'aabbcc' })
    expect(draft.joy).toBe('#123456') // server wins
    expect(draft.anger).toBe('#AABBCC') // normalized (missing #)
    expect(draft.calm).toBe(rec.calm) // not provided → recommended
    expect(isCompleteEmotionColors(draft)).toBe(true)
  })
  it('drops a malformed server color back to recommended', () => {
    const rec = recommendedEmotionColors()
    const draft = mergeEmotionColorDraft({ joy: '#xyz' })
    expect(draft.joy).toBe(rec.joy)
  })
})
