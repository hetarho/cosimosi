import { describe, expect, it } from 'vitest'

import {
  advanceAwakenFlares,
  createAwakenFlarePool,
  freeAwakenSlot,
  igniteAwakenFlare,
  moveAwakenFlares,
} from './awaken-flare-pool.ts'

const FRAME = 1 / 60

describe('awaken flare pool', () => {
  it('moves a lit seed smoothly into its live neuron and follows that neuron', () => {
    const pool = createAwakenFlarePool(1)
    igniteAwakenFlare(pool, 0)
    const origin = new Float32Array([0, 0, 0])
    const live = new Float32Array([10, 20, 30])
    const out = new Float32Array(3)
    pool.progress[0] = 1 / 3
    moveAwakenFlares(pool, origin, new Int32Array([0]), live, out)
    expect(out[0]).toBeCloseTo(5, 5)
    expect(out[1]).toBeCloseTo(10, 5)
    expect(out[2]).toBeCloseTo(15, 5)
    pool.progress[0] = 0.8
    live.set([12, 22, 32])
    moveAwakenFlares(pool, origin, new Int32Array([0]), live, out)
    expect([...out]).toEqual([12, 22, 32])
  })

  it('leaves a seed in place until its destination has a live buffer slot', () => {
    const pool = createAwakenFlarePool(1)
    igniteAwakenFlare(pool, 0)
    const out = new Float32Array([1, 2, 3])
    moveAwakenFlares(pool, out, new Int32Array([-1]), new Float32Array(), out)
    expect([...out]).toEqual([1, 2, 3])
  })
  it('writes nothing while no flare is playing', () => {
    const pool = createAwakenFlarePool(32)

    for (let frame = 0; frame < 120; frame++) {
      expect(advanceAwakenFlares(pool, FRAME)).toBe(false)
    }
    expect(Array.from(pool.scales).every((scale) => scale === 0)).toBe(true)
  })

  it('grows a live flare every frame and hands off at zero', () => {
    const pool = createAwakenFlarePool(4)
    igniteAwakenFlare(pool, freeAwakenSlot(pool))
    expect(pool.activeCount).toBe(1)

    let peak = 0
    let frames = 0
    while (pool.activeCount > 0 && frames < 600) {
      expect(advanceAwakenFlares(pool, FRAME)).toBe(true)
      peak = Math.max(peak, pool.scales[0] as number)
      frames += 1
    }

    // A sin(πp) envelope over a ~1.1 s life at 60 fps: it grew, peaked mid-life, and finished.
    expect(peak).toBeGreaterThan(0.85)
    expect(frames).toBeGreaterThan(30)
    expect(frames).toBeLessThan(120)
    expect(pool.scales[0]).toBe(0)
  })

  it('returns to the skip path the frame after the last flare completes', () => {
    const pool = createAwakenFlarePool(4)
    igniteAwakenFlare(pool, 0)
    while (pool.activeCount > 0) advanceAwakenFlares(pool, FRAME)

    // The completing frame still wrote (it zeroed the slot); every frame after it must not.
    expect(advanceAwakenFlares(pool, FRAME)).toBe(false)
  })

  it('caps a resume gap so one huge delta cannot skip a whole flare', () => {
    const pool = createAwakenFlarePool(4)
    igniteAwakenFlare(pool, 0)

    expect(advanceAwakenFlares(pool, 10)).toBe(true)

    expect(pool.activeCount).toBe(1)
    expect(pool.scales[0]).toBeGreaterThan(0)
  })

  it('reports the pool full instead of overwriting a live flare', () => {
    const pool = createAwakenFlarePool(2)
    igniteAwakenFlare(pool, 0)
    igniteAwakenFlare(pool, 1)

    expect(freeAwakenSlot(pool)).toBe(-1)
    expect(pool.activeCount).toBe(2)
  })
})
