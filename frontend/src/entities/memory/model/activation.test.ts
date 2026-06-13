import { describe, expect, it } from 'vitest'
import { moodRgb, NEUTRAL_RGB } from '@/shared/config'
import {
  A_MIN,
  activation,
  HALF_LIFE_DAYS,
  isDormant,
  LAMBDA,
  lambdaEff,
  modulatedBrightness,
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

describe('modulatedBrightness / lambdaEff (spec 26)', () => {
  const now = 1_700_000_000_000
  const d30 = now - 30 * DAY_MS
  // (degreeNorm, relevance, intensity, valence) → brightness at Δt=30d, all else equal.
  const at30 = (deg: number, rel: number, int: number, val: number) =>
    modulatedBrightness(d30, now, deg, rel, int, val)

  it('(a) more connections (degree↑) keep a star brighter at the same Δt (1.2)', () => {
    expect(at30(2, 0, 0.3, 0)).toBeGreaterThan(at30(0, 0, 0.3, 0))
  })

  it('(b) stronger emotion (intensity↑) keeps a star brighter (1.3)', () => {
    expect(at30(0, 0, 0.9, 0)).toBeGreaterThan(at30(0, 0, 0.1, 0))
  })

  it('(c) higher relevance to 요즘 토픽 keeps a star brighter (1.4)', () => {
    expect(at30(0, 0.9, 0.3, 0)).toBeGreaterThan(at30(0, 0, 0.3, 0))
  })

  it('(d) strong NEGATIVE valence resists decay extra (Kensinger & Corkin — DELTA_VAL)', () => {
    // same arousal; negative affect adds resistance, positive affect adds none.
    expect(at30(0, 0, 0.5, -0.8)).toBeGreaterThan(at30(0, 0, 0.5, 0.8))
  })

  it('(e) isolated·flat star decays ~2–3× faster than a connected·emotional one', () => {
    const connected = lambdaEff(1.2, 0.4, 0.75, -0.2)
    const isolated = lambdaEff(0, 0, 0.15, 0)
    const ratio = isolated / connected
    expect(ratio).toBeGreaterThanOrEqual(2)
    expect(ratio).toBeLessThanOrEqual(3.5)
    // …and the gap is visible: the connected star is clearly brighter at 30 and 90 days.
    expect(at30(1.2, 0.4, 0.75, -0.2)).toBeGreaterThan(at30(0, 0, 0.15, 0))
    const d90 = now - 90 * DAY_MS
    expect(modulatedBrightness(d90, now, 1.2, 0.4, 0.75, -0.2)).toBeGreaterThan(
      modulatedBrightness(d90, now, 0, 0, 0.15, 0),
    )
  })

  it('(f) floors at A_MIN for huge Δt — never below, never 0, never deleted (2.2, 헌법2)', () => {
    // Strongest resistance decays slowest, so it only reaches the floor for an enormous Δt;
    // both converge to EXACTLY A_MIN (not 0), and neither ever dips below it.
    const longAgo = now - 1_000_000 * DAY_MS
    const conn = modulatedBrightness(longAgo, now, 5, 1, 1, -1) // strongest resistance
    const iso = modulatedBrightness(longAgo, now, 0, 0, 0, 0) // weakest
    expect(conn).toBeCloseTo(A_MIN, 6)
    expect(iso).toBeCloseTo(A_MIN, 6)
    expect(iso).toBeGreaterThan(0)
    // Floor invariant at a moderate Δt too: a fast-decaying star never drops below A_MIN.
    expect(modulatedBrightness(now - 300 * DAY_MS, now, 0, 0, 0, 0)).toBeGreaterThanOrEqual(A_MIN)
  })

  it('(g) clamps stray inputs — λ_eff ≤ λ_base, brightness ≤ 1 (4.2)', () => {
    // negative degree, relevance>1, intensity>1, valence<-1 must not accelerate decay or
    // overshoot brightness. Δt=0 → exactly 1.0 (the (1-A_MIN)·exp ceiling), never above.
    expect(lambdaEff(-5, 2, 1.5, -3)).toBeLessThanOrEqual(LAMBDA + 1e-12)
    expect(modulatedBrightness(now, now, -5, 2, 1.5, -3)).toBeCloseTo(1, 10)
    expect(modulatedBrightness(now + DAY_MS, now, 2, 0.5, 0.5, -0.5)).toBeLessThanOrEqual(1)
  })

  it('(h) every R ∈ (0,1] so modulation only SLOWS decay (λ_eff ≤ λ_base = ln2/30)', () => {
    for (const [deg, rel, int, val] of [
      [0, 0, 0, 0],
      [3, 1, 1, -1],
      [0.5, 0.5, 0.5, 0.5],
    ] as const) {
      expect(lambdaEff(deg, rel, int, val)).toBeLessThanOrEqual(LAMBDA + 1e-12)
    }
    // all-neutral inputs leave λ_base untouched (the modulation ceiling).
    expect(lambdaEff(0, 0, 0, 0)).toBeCloseTo(LAMBDA, 12)
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
