import { describe, expect, it } from 'vitest'

import {
  createInstanceFrameKey,
  recordInstanceFrame,
  resetInstanceFrame,
  sameInstanceFrame,
  type InstanceFrameKey,
} from './instance-frame-gate.ts'
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

describe('instanced clean-frame gate', () => {
  const CHANNELS = { scales: new Float32Array([1]) }
  const BUFFER = new Float32Array(9)
  const baseline = (): InstanceFrameKey => ({
    bufferVersion: 7,
    buffer: BUFFER,
    channels: CHANNELS,
    count: 3,
    firstNodeIndex: 0,
    scale: 1,
    animationRevision: 0,
  })

  /** Compose once, then report whether a second frame stated by `mutate` would recompose. */
  function recomposesOn(mutate: (frame: InstanceFrameKey) => void): boolean {
    const composed = createInstanceFrameKey()
    recordInstanceFrame(composed, baseline())
    const next = baseline()
    mutate(next)
    return !sameInstanceFrame(composed, next)
  }

  it('composes the first frame after a mount — a fresh key matches nothing', () => {
    expect(sameInstanceFrame(createInstanceFrameKey(), baseline())).toBe(false)
  })

  it('skips a frame whose every input is unchanged', () => {
    expect(recomposesOn(() => undefined)).toBe(false)
  })

  it('recomposes on a new buffer version, even when the object is the same one', () => {
    expect(recomposesOn((frame) => (frame.bufferVersion = 8))).toBe(true)
  })

  it('recomposes when the positions ref is repointed at a buffer that reused the version', () => {
    // A rebuilt sim bridge starts its version at zero, so a version alone can repeat across
    // producers. The array identity cannot.
    expect(recomposesOn((frame) => (frame.buffer = new Float32Array(9)))).toBe(true)
  })

  it('recomposes on a slot-window, scale, channels or animation-revision change', () => {
    expect(recomposesOn((frame) => (frame.firstNodeIndex = 4))).toBe(true)
    expect(recomposesOn((frame) => (frame.count = 4))).toBe(true)
    expect(recomposesOn((frame) => (frame.scale = 1.5))).toBe(true)
    expect(recomposesOn((frame) => (frame.channels = { scales: new Float32Array([1]) }))).toBe(true)
    expect(recomposesOn((frame) => (frame.animationRevision = 1))).toBe(true)
  })

  it('never skips for a buffer that publishes no version', () => {
    // The NaN opt-out: fail open, because a wrongly skipped frame is a frozen scene with nothing
    // on screen to say why.
    const composed = createInstanceFrameKey()
    const unversioned = { ...baseline(), bufferVersion: Number.NaN }
    recordInstanceFrame(composed, unversioned)
    expect(sameInstanceFrame(composed, unversioned)).toBe(false)
  })

  it('forgets the composed frame on reset, so the next one recomposes', () => {
    const composed = createInstanceFrameKey()
    recordInstanceFrame(composed, baseline())
    expect(sameInstanceFrame(composed, baseline())).toBe(true)

    resetInstanceFrame(composed)

    expect(sameInstanceFrame(composed, baseline())).toBe(false)
  })
})
