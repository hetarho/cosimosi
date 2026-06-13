import { describe, expect, it } from 'vitest'
import { R_MAX, R_MIN, strength, targetRadius } from './layout'

describe('strength (spec 38)', () => {
  it('blends activation (0.7) and intensity (0.3)', () => {
    expect(strength(1, 1)).toBeCloseTo(1)
    expect(strength(0, 0)).toBeCloseTo(0)
    expect(strength(1, 0)).toBeCloseTo(0.7) // activation leads
    expect(strength(0, 1)).toBeCloseTo(0.3) // intensity tempers
  })

  it('clamps inputs and output to [0,1]', () => {
    expect(strength(2, 2)).toBe(1)
    expect(strength(-1, -1)).toBe(0)
  })
})

describe('targetRadius (spec 38)', () => {
  it('strength 1 → R_MIN (beside the self star), strength 0 → R_MAX (outer reaches)', () => {
    expect(targetRadius(1)).toBeCloseTo(R_MIN)
    expect(targetRadius(0)).toBeCloseTo(R_MAX)
  })

  it('is monotonically decreasing in strength (stronger = closer)', () => {
    expect(targetRadius(0.25)).toBeGreaterThan(targetRadius(0.75))
    expect(targetRadius(0.5)).toBeCloseTo((R_MIN + R_MAX) / 2)
  })

  it('clamps out-of-range strength', () => {
    expect(targetRadius(2)).toBeCloseTo(R_MIN)
    expect(targetRadius(-1)).toBeCloseTo(R_MAX)
  })
})
