import { describe, expect, it } from 'vitest'

import { syncVertexScale } from './instance-visibility.ts'

describe('instanced vertex-scale visibility', () => {
  it('collapses a hidden shader-displaced instance and restores its world scale', () => {
    const scales = new Float32Array([1.4, 2.2])

    expect(syncVertexScale(scales, 1, 0)).toBe(true)
    expect(scales[0]).toBeCloseTo(1.4)
    expect(scales[1]).toBe(0)

    const restoredScale = new Float32Array([2.2])[0] ?? 0
    expect(syncVertexScale(scales, 1, restoredScale)).toBe(true)
    expect(scales[1]).toBeCloseTo(2.2)
  })

  it('does not request an upload when the visible scale is unchanged', () => {
    const scales = new Float32Array([1.4])

    expect(syncVertexScale(scales, 0, scales[0] ?? 0)).toBe(false)
    expect(syncVertexScale(null, 0, 0)).toBe(false)
  })
})
