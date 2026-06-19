import { describe, expect, it } from 'vitest'
import { memoryR, retrievalStrength, storageStrength } from './weight'

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
