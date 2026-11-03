import { FORCE_SIM_COORDINATE_STRIDE } from '@cosimosi/force-sim'

/**
 * The centre of mass of the live layout, remembered against the buffer it was measured from. It is
 * emergent like every position ([I5]), so it is measured rather than stored — but a settled layout
 * presents the same buffer at the same version frame after frame, and the O(n) sum then has nothing
 * new to say.
 */
export interface LayoutCentroid {
  readonly center: [number, number, number]
  buffer: Float32Array | null
  version: number
}

export function createLayoutCentroid(): LayoutCentroid {
  return { center: [0, 0, 0], buffer: null, version: Number.NaN }
}

/**
 * Bring `centroid.center` up to the presented buffer. Returns whether it measured; an unchanged
 * buffer and version read the remembered centre. A buffer too short to hold one node keeps the last
 * centre, so a universe still settling never snaps to the origin and back.
 */
export function measureLayoutCentroid(
  centroid: LayoutCentroid,
  buffer: Float32Array | null,
  version: number,
): boolean {
  if (!buffer || buffer.length < FORCE_SIM_COORDINATE_STRIDE) return false
  if (centroid.buffer === buffer && centroid.version === version) return false
  const count = Math.floor(buffer.length / FORCE_SIM_COORDINATE_STRIDE)
  let x = 0
  let y = 0
  let z = 0
  for (let i = 0; i < count; i++) {
    const offset = i * FORCE_SIM_COORDINATE_STRIDE
    x += buffer[offset] ?? 0
    y += buffer[offset + 1] ?? 0
    z += buffer[offset + 2] ?? 0
  }
  centroid.center[0] = x / count
  centroid.center[1] = y / count
  centroid.center[2] = z / count
  centroid.buffer = buffer
  centroid.version = version
  return true
}
