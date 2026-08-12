import { describe, expect, it } from 'vitest'

import {
  createPinnedOffset,
  pinnedCameraPosition,
  readPinnedOffset,
  type PinnedEnvelope,
} from './pinned-pose.ts'

const ENVELOPE: PinnedEnvelope = {
  maxTilt: (15 * Math.PI) / 180,
  minDistance: 8,
  maxDistance: 420,
}

const CENTER = { x: 3, y: -2, z: 5 }

describe('readPinnedOffset', () => {
  it('leaves a camera that is already flat and inside the envelope where it stands', () => {
    const offset = readPinnedOffset(
      createPinnedOffset(),
      { x: CENTER.x + 100, y: CENTER.y, z: CENTER.z },
      CENTER,
      ENVELOPE,
    )

    expect(offset.azimuth).toBeCloseTo(0, 10)
    expect(offset.elevation).toBeCloseTo(0, 10)
    expect(offset.radius).toBeCloseTo(100, 10)
  })

  it('clamps the tilt off the flat in both directions, keeping the azimuth the viewer chose', () => {
    // Straight up would be 90° off the flat; the pinned view allows 15.
    const above = readPinnedOffset(
      createPinnedOffset(),
      { x: CENTER.x, y: CENTER.y + 10, z: CENTER.z + 90 },
      CENTER,
      ENVELOPE,
    )
    const below = readPinnedOffset(
      createPinnedOffset(),
      { x: CENTER.x, y: CENTER.y + 10, z: CENTER.z - 90 },
      CENTER,
      ENVELOPE,
    )

    expect(above.elevation).toBeCloseTo(ENVELOPE.maxTilt, 10)
    expect(below.elevation).toBeCloseTo(-ENVELOPE.maxTilt, 10)
    // +y from the centre, both times — the clamp bounds the tilt, never the way round.
    expect(above.azimuth).toBeCloseTo(Math.PI / 2, 10)
    expect(below.azimuth).toBeCloseTo(Math.PI / 2, 10)
  })

  it('clamps the distance into the zoom envelope at both ends', () => {
    const tooNear = readPinnedOffset(
      createPinnedOffset(),
      { x: CENTER.x + 1, y: CENTER.y, z: CENTER.z },
      CENTER,
      ENVELOPE,
    )
    const tooFar = readPinnedOffset(
      createPinnedOffset(),
      { x: CENTER.x + 9000, y: CENTER.y, z: CENTER.z },
      CENTER,
      ENVELOPE,
    )

    expect(tooNear.radius).toBe(ENVELOPE.minDistance)
    expect(tooFar.radius).toBe(ENVELOPE.maxDistance)
  })

  it('gives a camera sitting exactly on the centre a usable pose rather than a degenerate one', () => {
    const offset = readPinnedOffset(createPinnedOffset(), { ...CENTER }, CENTER, ENVELOPE)

    expect(offset.radius).toBe(ENVELOPE.minDistance)
    expect(Number.isFinite(offset.azimuth)).toBe(true)
    expect(offset.elevation).toBe(0)
  })
})

describe('pinnedCameraPosition', () => {
  it('round-trips an offset that is already inside the envelope', () => {
    const camera = { x: CENTER.x - 60, y: CENTER.y + 25, z: CENTER.z + 7 }
    const offset = readPinnedOffset(createPinnedOffset(), camera, CENTER, ENVELOPE)

    const back = pinnedCameraPosition({ x: 0, y: 0, z: 0 }, CENTER, offset)

    expect(back.x).toBeCloseTo(camera.x, 6)
    expect(back.y).toBeCloseTo(camera.y, 6)
    expect(back.z).toBeCloseTo(camera.z, 6)
  })

  it('puts a clamped camera back at the tilt limit, at the same distance and the same way round', () => {
    const camera = { x: CENTER.x, y: CENTER.y, z: CENTER.z + 100 }
    const offset = readPinnedOffset(createPinnedOffset(), camera, CENTER, ENVELOPE)

    const goal = pinnedCameraPosition({ x: 0, y: 0, z: 0 }, CENTER, offset)
    const radius = Math.hypot(goal.x - CENTER.x, goal.y - CENTER.y, goal.z - CENTER.z)
    const elevation = Math.asin((goal.z - CENTER.z) / radius)

    expect(radius).toBeCloseTo(100, 6)
    expect(elevation).toBeCloseTo(ENVELOPE.maxTilt, 6)
  })
})
