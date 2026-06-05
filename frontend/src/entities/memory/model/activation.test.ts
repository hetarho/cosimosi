import { describe, expect, it } from 'vitest'
import { moodRgb, NEUTRAL_RGB } from '@/shared/config'
import { A_MIN, activation, HALF_LIFE_DAYS, starBrightness } from './activation'

const DAY_MS = 86_400_000

describe('activation', () => {
  it('is 1.0 at Δt=0 (1.3)', () => {
    const now = 1_700_000_000_000
    expect(activation(now, now)).toBeCloseTo(1.0, 10)
  })

  it('is ~0.5 after one half-life (30 days) (1.3)', () => {
    const now = 1_700_000_000_000
    const past = now - HALF_LIFE_DAYS * DAY_MS
    expect(activation(past, now)).toBeGreaterThan(0.49)
    expect(activation(past, now)).toBeLessThan(0.51)
  })

  it('floors brightness at A_MIN for large Δt — stars never disappear (1.4)', () => {
    const now = 1_700_000_000_000
    const longAgo = now - 1000 * DAY_MS // ~3 years
    expect(activation(longAgo, now)).toBeLessThan(A_MIN)
    expect(starBrightness(longAgo, now)).toBe(A_MIN)
  })

  it('treats a future lastRecalledAt as Δt=0 (no >1 brightness)', () => {
    const now = 1_700_000_000_000
    expect(activation(now + DAY_MS, now)).toBe(1.0)
  })
})

describe('moodRgb', () => {
  it('returns the palette color for a known mood (1.2)', () => {
    expect(moodRgb('joy')).toEqual([1.0, 0.84, 0.3])
  })

  it('falls back to NEUTRAL_RGB for an unknown mood, no throw (1.5)', () => {
    expect(() => moodRgb('chartreuse')).not.toThrow()
    expect(moodRgb('chartreuse')).toBe(NEUTRAL_RGB)
    expect(moodRgb('')).toBe(NEUTRAL_RGB)
  })
})
