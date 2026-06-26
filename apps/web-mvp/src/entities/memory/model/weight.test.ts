import { describe, expect, it } from 'vitest'
import {
  memoryR,
  memoryRadiusR,
  radiusConnectedness,
  retrievalStrength,
  storageStrength,
} from './weight'

const DAY_MS = 86_400_000

describe('storageStrength', () => {
  it('grows with recall count and emotional intensity', () => {
    expect(storageStrength(5, 0.8)).toBeGreaterThan(storageStrength(1, 0.8))
    expect(storageStrength(3, 0.9)).toBeGreaterThan(storageStrength(3, 0.1))
  })

  it('is positive even at zero recall (base encoding)', () => {
    expect(storageStrength(0, 0)).toBeGreaterThan(0)
  })
})

describe('retrievalStrength', () => {
  it('is ≈1 just after recall and falls toward 0 with time', () => {
    expect(retrievalStrength(2, 0)).toBeCloseTo(1, 5)
    expect(retrievalStrength(2, 1000)).toBeLessThan(0.2)
  })

  it('higher storage strength forgets slower at the same Δt (spacing effect)', () => {
    const lowS = storageStrength(1, 0.2)
    const highS = storageStrength(10, 0.9)
    const dt = 30
    expect(retrievalStrength(highS, dt)).toBeGreaterThan(retrievalStrength(lowS, dt))
  })
})

describe('memoryR', () => {
  it('a just-recalled star reads R≈1 (centre); a long-dormant one reads low (outer)', () => {
    const now = 1_000 * DAY_MS
    expect(memoryR(1, 0.5, now, now)).toBeCloseTo(1, 5)
    expect(memoryR(1, 0.5, now - 365 * DAY_MS, now)).toBeLessThan(0.2)
  })

  it('an often-recalled star stays more central than a once-recalled one after the same gap', () => {
    const now = 1_000 * DAY_MS
    const dtDays = 60
    const often = memoryR(20, 0.8, now - dtDays * DAY_MS, now)
    const once = memoryR(1, 0.8, now - dtDays * DAY_MS, now)
    expect(often).toBeGreaterThan(once)
  })
})

describe('radiusConnectedness (spec 38 change 18)', () => {
  it('combines degree count and Σweight, clamping negatives to 0', () => {
    expect(radiusConnectedness(0, 0)).toBe(0)
    expect(radiusConnectedness(2, 2)).toBeGreaterThan(radiusConnectedness(2, 0))
    expect(radiusConnectedness(-5, -5)).toBe(0)
  })
})

describe('memoryRadiusR (connectivity slows the radial drift)', () => {
  const now = 1_000 * DAY_MS
  const dtDays = 60
  const last = now - dtDays * DAY_MS

  it('connectedness=0 is identical to memoryR (pure time decay)', () => {
    expect(memoryRadiusR(1, 0.5, last, now, 0)).toBeCloseTo(memoryR(1, 0.5, last, now), 10)
  })

  it('higher connectivity keeps a HIGHER R at the same Δt (decay slowed, A1·A2)', () => {
    const lonely = memoryRadiusR(1, 0.5, last, now, 0)
    const hub = memoryRadiusR(1, 0.5, last, now, radiusConnectedness(3, 3))
    expect(hub).toBeGreaterThan(lonely)
  })

  it('only SLOWS decay — never exceeds 1 nor drops below the unconnected R (A3)', () => {
    const lonely = memoryRadiusR(1, 0.5, last, now, 0)
    const hub = memoryRadiusR(5, 0.9, last, now, radiusConnectedness(10, 10))
    expect(hub).toBeLessThanOrEqual(1)
    expect(hub).toBeGreaterThanOrEqual(lonely)
    // even a just-recalled, hugely-connected star stays at R≈1 (can't overshoot the centre)
    expect(memoryRadiusR(50, 1, now, now, radiusConnectedness(50, 50))).toBeCloseTo(1, 5)
  })
})
