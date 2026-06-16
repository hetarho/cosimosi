import { VALUES } from '@/shared/config'

// Frame-all camera geometry (spec 28) — the PURE half of "원본 일기로 별 찾기": given the
// LIVE star coordinates (the single source — force-sim buffer, 헌법3) and the slots of one
// diary's stars, compute the vantage that fits them ALL on screen. No three/React/DOM
// (헌법4, 모바일 재사용; acceptance 1.10) — only Math. The widget controller reads the live
// buffer and applies the result as a fly-to (12 lerp/damp), so coordinates are READ, never
// authored (acceptance 1.7).

/** The geometric framing of a star set: centroid + bounding radius + the camera distance
 *  that fits the bounding sphere in view. The controller places the camera at
 *  `center + dir·distance` (lookAt = center) for some view direction. */
export interface FrameTarget {
  center: [number, number, number]
  radius: number
  distance: number
}

// Breathing room so the outermost star isn't flush against the screen edge.
export const FRAME_MARGIN = VALUES.wayfinding.frameMargin
// Degenerate floor (acceptance 1.8): a single-star diary has radius≈0, so the fit distance
// collapses to 0 — floor it at the same 12-unit offset the single-star fly-to parks at
// (UniverseCanvas FlyToController), so frame-all converges to the single-focus look.
export const FRAME_MIN_DISTANCE = VALUES.wayfinding.frameMinDistance

/** Compute the frame-all target for the stars at `slots` (indices into the force-sim
 *  positions buffer, x/y/z interleaved). fovRad is the LIMITING field of view (the smaller
 *  of the camera's vertical/horizontal fov, so the sphere fits in BOTH dimensions). Returns
 *  null when no slot is in range (nothing to frame). Pure — `now`/coords come from the caller.
 *
 *  distance = max(FRAME_MIN_DISTANCE, R / sin(fovRad/2) · MARGIN): R/sin(half-fov) is the
 *  distance at which a sphere of radius R exactly fills the fov; MARGIN pads it; the floor
 *  handles the R≈0 single-star case (1.8). */
export function frameTarget(
  positions: Float32Array,
  slots: number[],
  fovRad: number,
): FrameTarget | null {
  const count = Math.floor(positions.length / 3)
  // Gather only the in-range slots; compute the centroid in one pass.
  let n = 0
  let cx = 0
  let cy = 0
  let cz = 0
  for (const slot of slots) {
    if (slot < 0 || slot >= count) continue
    cx += positions[slot * 3]
    cy += positions[slot * 3 + 1]
    cz += positions[slot * 3 + 2]
    n++
  }
  if (n === 0) return null
  cx /= n
  cy /= n
  cz /= n

  // Bounding radius = the farthest star from the centroid.
  let r2 = 0
  for (const slot of slots) {
    if (slot < 0 || slot >= count) continue
    const dx = positions[slot * 3] - cx
    const dy = positions[slot * 3 + 1] - cy
    const dz = positions[slot * 3 + 2] - cz
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > r2) r2 = d2
  }
  const radius = Math.sqrt(r2)

  const halfFov = fovRad / 2
  const sinHalf = Math.sin(halfFov)
  // sinHalf > 0 for any real fov in (0, π); guard anyway so a degenerate fov can't divide by 0.
  const fit = sinHalf > 1e-6 ? (radius / sinHalf) * FRAME_MARGIN : FRAME_MIN_DISTANCE
  const distance = Math.max(FRAME_MIN_DISTANCE, fit)

  return { center: [cx, cy, cz], radius, distance }
}
