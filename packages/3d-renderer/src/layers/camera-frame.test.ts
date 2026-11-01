import { describe, expect, it } from 'vitest'
import {
  createCameraRevision,
  updateCameraRevision,
  createInstanceFrameKey,
  recordInstanceFrame,
  sameInstanceFrame,
} from './instance-frame-gate.ts'

describe('camera-facing frame ownership', () => {
  it('skips a stable version and recomposes on camera motion or rotation', () => {
    const camera = createCameraRevision()
    const previous = createInstanceFrameKey()
    const next = createInstanceFrameKey()
    next.bufferVersion = 1
    next.scale = 1
    next.animationRevision = updateCameraRevision(camera, 1, 2, 3, 1)
    recordInstanceFrame(previous, next)
    next.animationRevision = updateCameraRevision(camera, 1, 2, 3, 1)
    expect(sameInstanceFrame(previous, next)).toBe(true)
    next.animationRevision = updateCameraRevision(camera, 1, 2, 3, 0.5)
    expect(sameInstanceFrame(previous, next)).toBe(false)
    recordInstanceFrame(previous, next)
    next.animationRevision = updateCameraRevision(camera, 2, 2, 3, 0.5)
    expect(sameInstanceFrame(previous, next)).toBe(false)
  })
})
