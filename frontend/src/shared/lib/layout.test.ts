import { describe, expect, it } from 'vitest'
import {
  applyAngularDrift,
  R_MAX,
  R_MIN,
  scatterDirection,
  targetRadius,
} from './layout'

const mag = (v: readonly [number, number, number]) => Math.hypot(v[0], v[1], v[2])
const angleBetween = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
) => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot / (mag(a) * mag(b)))))
}

describe('targetRadius (spec 38·07 — Bjork retrieval strength R)', () => {
  it('R 1 → R_MIN (beside the self star), R 0 → R_MAX (outer reaches)', () => {
    expect(targetRadius(1)).toBeCloseTo(R_MIN)
    expect(targetRadius(0)).toBeCloseTo(R_MAX)
  })

  it('is monotonically decreasing in R (stronger = closer)', () => {
    expect(targetRadius(0.25)).toBeGreaterThan(targetRadius(0.75))
    expect(targetRadius(0.5)).toBeCloseTo((R_MIN + R_MAX) / 2)
  })

  it('clamps out-of-range R', () => {
    expect(targetRadius(2)).toBeCloseTo(R_MIN)
    expect(targetRadius(-1)).toBeCloseTo(R_MAX)
  })
})

describe('scatterDirection (spec 40)', () => {
  it('returns a unit vector', () => {
    for (const seed of [0, 0.1, 0.37, 0.5, 0.99]) {
      expect(mag(scatterDirection(seed))).toBeCloseTo(1, 5)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(scatterDirection(0.42)).toEqual(scatterDirection(0.42))
  })

  it('decorrelates ADJACENT seedFromId outputs (k/2³² for adjacent k), not just far-apart seeds', () => {
    // seedFromId returns k/2³² for an integer FNV hash k. Adjacent ids (hashes k, k+1) must get
    // distinct directions — a sub-2³² multiplier would COMPRESS the seed and collapse neighbors
    // onto the same direction (and the same drift axis). Recovering k via seed·2³² + mulberry32
    // avalanche keeps them apart. (This is the real input space; a 0.1-vs-0.2 test never hits it.)
    const s0 = scatterDirection(0 / 4294967296)
    const s1 = scatterDirection(1 / 4294967296)
    const s2 = scatterDirection(2 / 4294967296)
    expect(angleBetween(s0, s1)).toBeGreaterThan(0.1)
    expect(angleBetween(s1, s2)).toBeGreaterThan(0.1)
  })
})

describe('applyAngularDrift (spec 40)', () => {
  const pos: [number, number, number] = [10, 0, 0]

  it('preserves |pos| — radius (=strength, spec 38) is untouched, only direction rotates', () => {
    expect(mag(applyAngularDrift(pos, 0.3, 5))).toBeCloseTo(10, 5)
    expect(mag(applyAngularDrift([3, -7, 4], 0.8, 12))).toBeCloseTo(Math.hypot(3, -7, 4), 5)
  })

  it('nights 0 → no rotation (static between night boundaries — spec 40 1.6)', () => {
    expect(applyAngularDrift(pos, 0.3, 0)).toEqual([10, 0, 0])
  })

  it('actually rotates the direction for nights > 0', () => {
    expect(angleBetween(pos, applyAngularDrift(pos, 0.3, 5))).toBeGreaterThan(0.01)
  })

  it('accumulates as a fixed-axis rotation group: drift(N) === N×drift(1) (skip == wait)', () => {
    // The whole point of a fixed (pos-independent) axis: a demo skip of N days (one call, dn=N)
    // must land exactly where N real nights (N single-night calls) would. A pos-derived axis
    // sign-flips once pos rotates near it and the two paths diverge — this guards that.
    let stepwise: [number, number, number] = [pos[0], pos[1], pos[2]]
    for (let i = 0; i < 6; i++) stepwise = applyAngularDrift(stepwise, 0.3, 1)
    const oneShot = applyAngularDrift(pos, 0.3, 6)
    expect(oneShot[0]).toBeCloseTo(stepwise[0], 4)
    expect(oneShot[1]).toBeCloseTo(stepwise[1], 4)
    expect(oneShot[2]).toBeCloseTo(stepwise[2], 4)
  })

  it('is deterministic', () => {
    expect(applyAngularDrift(pos, 0.55, 4)).toEqual(applyAngularDrift(pos, 0.55, 4))
  })
})
