import { describe, expect, it } from 'vitest'

import {
  ADAPTIVE_DPR_FLOOR,
  createAdaptiveDprSampler,
  sampleAdaptiveDpr,
  type AdaptiveDprThresholds,
} from './adaptive-dpr.ts'

const THRESHOLDS: AdaptiveDprThresholds = {
  maxPixelRatio: 2,
  windowSeconds: 1.5,
  downFps: 45,
  upFps: 57,
  step: 0.25,
  maxFlipflops: 2,
}

/**
 * Run the walk against a device whose frame rate REACTS to the ratio — the feedback that makes a
 * plain fps dead band oscillate. `fpsAt` is the device; the returned list is every step it saw.
 */
function walk(
  fpsAt: (pixelRatio: number) => number,
  seconds: number,
  startRatio: number,
  thresholds: AdaptiveDprThresholds = THRESHOLDS,
): number[] {
  const sampler = createAdaptiveDprSampler()
  const steps: number[] = []
  let ratio = startRatio
  let elapsed = 0
  while (elapsed < seconds) {
    const delta = 1 / fpsAt(ratio)
    const next = sampleAdaptiveDpr(sampler, delta, ratio, thresholds)
    if (next !== null) {
      steps.push(next)
      ratio = next
    }
    elapsed += delta
  }
  return steps
}

/** A device with a flat frame rate, whatever the ratio. */
const flat = (fps: number) => () => fps

describe('adaptive dpr walk', () => {
  it('holds the ratio still until a window has closed', () => {
    const sampler = createAdaptiveDprSampler()
    const delta = 1 / 30
    for (let elapsed = 0; elapsed + delta < THRESHOLDS.windowSeconds; elapsed += delta) {
      expect(sampleAdaptiveDpr(sampler, delta, 2, THRESHOLDS)).toBeNull()
    }
    expect(sampleAdaptiveDpr(sampler, delta, 2, THRESHOLDS)).toBe(1.75)
  })

  it('steps down one notch per window on sustained slow frames, and stops at the floor', () => {
    // 2 → 1.75 → 1.5 → 1.25 → 1, then nothing: four steps and no fifth.
    expect(walk(flat(30), 30, 2)).toEqual([1.75, 1.5, 1.25, ADAPTIVE_DPR_FLOOR])
  })

  it('climbs back to the cap when frames are fast, and stops there', () => {
    expect(walk(flat(60), 30, 1)).toEqual([1.25, 1.5, 1.75, 2])
  })

  it('does not move inside the dead band between the two thresholds', () => {
    expect(walk(flat(50), 60, 1.5)).toEqual([])
  })

  it('settles instead of ping-ponging when dropping the ratio is what buys the frame rate', () => {
    // The device the plain dead band cannot handle: too slow at 2, comfortably fast at 1.75. Every
    // measurement is honest and every threshold is respected, and it still oscillates forever
    // unless the walk remembers that it has already been here.
    const borderline = (ratio: number) => (ratio >= 2 ? 44 : 58)

    const steps = walk(borderline, 300, 2)

    // Down to 1.75, one retry of 2, then down again for good — and nothing after that.
    expect(steps).toEqual([1.75, 2, 1.75])
    // It settled on the ratio the device can actually hold, never the one it failed at.
    expect(steps.at(-1)).toBe(1.75)
  })

  it('settles on the FIRST reversal when configured to allow no retry', () => {
    const borderline = (ratio: number) => (ratio >= 2 ? 44 : 58)

    // maxFlipflops 1: the reversing step up is refused outright, so one resize is the whole cost.
    expect(walk(borderline, 300, 2, { ...THRESHOLDS, maxFlipflops: 1 })).toEqual([1.75])
  })

  it('does not spend a flip-flop on a step that a bound swallowed', () => {
    const sampler = createAdaptiveDprSampler()
    // Sitting at the cap with headroom: every window wants to climb and there is nowhere to climb
    // to, so nothing is applied and no direction is taken.
    for (let elapsed = 0; elapsed < 5; elapsed += 1 / 60) {
      expect(sampleAdaptiveDpr(sampler, 1 / 60, 2, THRESHOLDS)).toBeNull()
    }
    expect(sampler.lastDirection).toBe(0)
    expect(sampler.flipflops).toBe(0)

    // The scene then gets heavy. Had those clamped windows registered as "up", the first real
    // down-step would have read as a reversal and the walk would have settled one notch in.
    const steps: number[] = []
    let ratio = 2
    for (let elapsed = 0; elapsed < 20; elapsed += 1 / 30) {
      const next = sampleAdaptiveDpr(sampler, 1 / 30, ratio, THRESHOLDS)
      if (next !== null) {
        steps.push(next)
        ratio = next
      }
    }
    expect(steps).toEqual([1.75, 1.5, 1.25, ADAPTIVE_DPR_FLOOR])
  })

  it('ignores a resume gap instead of reading it as a one-frame window', () => {
    const sampler = createAdaptiveDprSampler()
    // A backgrounded app foregrounding reports one enormous delta. Averaged in it would read as
    // ~0.2 fps and cost a step for a stall that is already over.
    expect(sampleAdaptiveDpr(sampler, 5, 2, THRESHOLDS)).toBeNull()
    // And it did not leave the window half-open: a full window of good frames follows normally.
    expect(walk(flat(60), 1.6, 1.75)).toEqual([2])
  })

  it('ignores non-frames — a zero, negative or non-finite delta', () => {
    const sampler = createAdaptiveDprSampler()
    for (const delta of [0, -1 / 60, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sampleAdaptiveDpr(sampler, delta, 2, THRESHOLDS)).toBeNull()
    }
    expect(sampler.windowFrames).toBe(0)
  })

  it('steps from the ratio actually in force, so a host-side clamp is never argued with', () => {
    // Native resolves the range against the device's own ratio, so the applied ratio can sit below
    // what was last requested. The next window must step from 1.5, not from the requested 2.
    const sampler = createAdaptiveDprSampler()
    const delta = 1 / 30
    let last: number | null = null
    for (let elapsed = 0; elapsed < 1.6; elapsed += delta) {
      last = sampleAdaptiveDpr(sampler, delta, 1.5, THRESHOLDS) ?? last
    }
    expect(last).toBe(1.25)
  })
})
