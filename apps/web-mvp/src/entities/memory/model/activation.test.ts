import { describe, expect, it } from 'vitest'
import { moodRgb, NEUTRAL_RGB } from '@/shared/config'
import { R_MIN, R_MAX } from '@/shared/lib'
import {
  A_MIN,
  activation,
  brightnessFromRadius,
  HALF_LIFE_DAYS,
  isDormant,
  starBrightness,
  starGlow,
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

describe('brightnessFromRadius (spec 38 change 19 — 밝기=자기-거리)', () => {
  it('R_MIN → full brightness, R_MAX → exactly the A_MIN floor (A1·A3)', () => {
    expect(brightnessFromRadius(R_MIN)).toBeCloseTo(1, 10)
    expect(brightnessFromRadius(R_MAX)).toBeCloseTo(A_MIN, 10)
  })

  it('is monotone decreasing in radius — a nearer star is brighter (A1)', () => {
    const near = brightnessFromRadius(R_MIN + (R_MAX - R_MIN) * 0.25)
    const far = brightnessFromRadius(R_MIN + (R_MAX - R_MIN) * 0.75)
    expect(near).toBeGreaterThan(far)
  })

  it('clamps out-of-range radius and never drops below A_MIN (헌법2)', () => {
    expect(brightnessFromRadius(R_MIN - 100)).toBeCloseTo(1, 10)
    expect(brightnessFromRadius(R_MAX + 100)).toBeCloseTo(A_MIN, 10)
    expect(brightnessFromRadius(R_MAX + 100)).toBeGreaterThanOrEqual(A_MIN)
  })
})

describe('starGlow (spec 38 change 19 — brightness through the radius, no separate decay)', () => {
  const now = 1_700_000_000_000
  const d60 = now - 60 * DAY_MS

  it('a just-recalled star is full brightness; a long-dormant one bottoms at A_MIN (A4)', () => {
    expect(starGlow(1, 0.5, now, now, 0, 0)).toBeCloseTo(1, 5)
    expect(starGlow(1, 0.5, now - 100_000 * DAY_MS, now, 0, 0)).toBeCloseTo(A_MIN, 5)
  })

  it('connectivity keeps a star brighter at the same Δt — through the radius (A5·A2)', () => {
    const lonely = starGlow(1, 0.5, d60, now, 0, 0)
    const hub = starGlow(1, 0.5, d60, now, 3, 3)
    expect(hub).toBeGreaterThan(lonely)
  })

  it('recall (smaller Δt) brightens; recall/intensity reach brightness via the radius', () => {
    const faded = starGlow(1, 0.5, d60, now, 0, 0)
    const recalled = starGlow(1, 0.5, now - 5 * DAY_MS, now, 0, 0)
    expect(recalled).toBeGreaterThan(faded)
    // an often-recalled, intense star stays brighter than a once-recalled flat one at the same Δt
    expect(starGlow(20, 0.9, d60, now, 0, 0)).toBeGreaterThan(starGlow(1, 0.1, d60, now, 0, 0))
  })

  it('never exceeds 1 nor drops below A_MIN for any input (헌법2)', () => {
    expect(starGlow(50, 1, now, now, 50, 50)).toBeLessThanOrEqual(1)
    expect(starGlow(0, 0, now - 1_000_000 * DAY_MS, now, 0, 0)).toBeGreaterThanOrEqual(A_MIN)
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
