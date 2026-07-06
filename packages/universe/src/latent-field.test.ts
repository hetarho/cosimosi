import { describe, expect, it } from 'vitest'

import { generateLatentField } from './latent-field.ts'

const PARAMS = { seed: 190019, count: 500, zMin: 0, zMax: 10, radius: 34 } as const

describe('generateLatentField', () => {
  it('is deterministic — the same seed yields an identical field (web↔mobile parity)', () => {
    const a = generateLatentField(PARAMS)
    const b = generateLatentField(PARAMS)
    expect(a.positions).toEqual(b.positions)
  })

  it('produces exactly `count` points (interleaved xyz)', () => {
    const field = generateLatentField(PARAMS)
    expect(field.count).toBe(PARAMS.count)
    expect(field.positions.length).toBe(PARAMS.count * 3)
  })

  it('places every point inside the hippocampus z-band', () => {
    const field = generateLatentField(PARAMS)
    for (let i = 0; i < field.count; i++) {
      const z = field.positions[i * 3 + 2]
      expect(z).toBeGreaterThanOrEqual(PARAMS.zMin)
      expect(z).toBeLessThanOrEqual(PARAMS.zMax)
    }
  })

  it('fills the visible x,y volume within the field radius', () => {
    const field = generateLatentField(PARAMS)
    let maxRadius = 0
    for (let i = 0; i < field.count; i++) {
      const x = field.positions[i * 3]
      const y = field.positions[i * 3 + 1]
      maxRadius = Math.max(maxRadius, Math.hypot(x, y))
    }
    expect(maxRadius).toBeLessThanOrEqual(PARAMS.radius)
    // A 500-point disc should actually reach out toward its edge, not clump at the center.
    expect(maxRadius).toBeGreaterThan(PARAMS.radius * 0.7)
  })

  it('carries no per-point identity — it is only positions (no color/brightness channel)', () => {
    const field = generateLatentField(PARAMS)
    expect(Object.keys(field).sort()).toEqual(['count', 'positions'])
  })

  it('returns an empty field for a non-positive count', () => {
    const field = generateLatentField({ ...PARAMS, count: 0 })
    expect(field.count).toBe(0)
    expect(field.positions.length).toBe(0)
  })
})
