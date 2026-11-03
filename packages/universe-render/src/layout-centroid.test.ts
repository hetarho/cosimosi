import { describe, expect, it } from 'vitest'

import { createLayoutCentroid, measureLayoutCentroid } from './layout-centroid.ts'

describe('measureLayoutCentroid', () => {
  it('measures once per presented buffer version', () => {
    const centroid = createLayoutCentroid()
    const buffer = new Float32Array([0, 0, 0, 4, 2, 6])
    let measured = 0
    const frame = (version: number, presented: Float32Array | null = buffer) => {
      if (measureLayoutCentroid(centroid, presented, version)) measured++
    }

    frame(1)
    frame(1)
    frame(1)
    expect(measured).toBe(1)
    expect(centroid.center).toEqual([2, 1, 3])

    // The sim presents a new picture, then a rebuilt bridge restarts at a version already seen.
    buffer[3] = 8
    frame(2)
    frame(1, new Float32Array([2, 2, 2]))
    expect(measured).toBe(3)
    expect(centroid.center).toEqual([2, 2, 2])
  })

  it('keeps the last centre while there is nothing to measure', () => {
    const centroid = createLayoutCentroid()
    measureLayoutCentroid(centroid, new Float32Array([3, 3, 3]), 1)
    expect(measureLayoutCentroid(centroid, null, 2)).toBe(false)
    expect(measureLayoutCentroid(centroid, new Float32Array(0), 3)).toBe(false)
    expect(centroid.center).toEqual([3, 3, 3])
  })
})
