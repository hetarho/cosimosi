import { describe, expect, it } from 'vitest'
import { moodRgb, NEUTRAL_RGB } from '@/shared/config'
import {
  A_MIN,
  activation,
  HALF_LIFE_DAYS,
  isDormant,
  starBrightness,
  synapseBrightness,
} from './activation'

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

describe('synapseBrightness (spec 12, 1.3)', () => {
  const now = 1_700_000_000_000

  it('is weight · activation when fresh (Δt=0)', () => {
    expect(synapseBrightness(0.8, now, now)).toBeCloseTo(0.8, 10)
  })

  it('scales weight by the activation decay', () => {
    const past = now - HALF_LIFE_DAYS * DAY_MS // activation ≈ 0.5
    expect(synapseBrightness(1.0, past, now)).toBeGreaterThan(0.49)
    expect(synapseBrightness(1.0, past, now)).toBeLessThan(0.51)
  })

  it('floors the activation factor at A_MIN (link dims but never vanishes)', () => {
    const longAgo = now - 1000 * DAY_MS // activation ≪ A_MIN
    expect(synapseBrightness(1.0, longAgo, now)).toBeCloseTo(A_MIN, 10)
    expect(synapseBrightness(0.5, longAgo, now)).toBeCloseTo(0.5 * A_MIN, 10)
  })
})

describe('isDormant (spec 12)', () => {
  const now = 1_700_000_000_000

  it('is false for a freshly recalled star', () => {
    expect(isDormant(now, now)).toBe(false)
  })

  it('is true once raw activation falls to/below the default 2·A_MIN threshold', () => {
    // activation = 2·A_MIN = 0.1 at Δt = ln(1/0.1)/λ = 30·log2(10) ≈ 99.66 days.
    const days = HALF_LIFE_DAYS * Math.log2(1 / (2 * A_MIN))
    expect(isDormant(now - (days + 1) * DAY_MS, now)).toBe(true)
    expect(isDormant(now - (days - 1) * DAY_MS, now)).toBe(false)
  })

  it('respects a custom threshold (boundary on raw activation)', () => {
    const past = now - HALF_LIFE_DAYS * DAY_MS // activation ≈ 0.5
    expect(isDormant(past, now, 0.5)).toBe(true) // 0.5 ≤ 0.5
    expect(isDormant(past, now, 0.49)).toBe(false)
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
