import { Vector3 } from 'three/webgpu'

type Point = readonly [number, number, number]
export interface SceneBounds {
  readonly min: Point
  readonly max: Point
}
export interface FrameInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** The thinnest half-span, in normalized device units, either axis of the open region may shrink to. */
const MIN_HALF_SPAN = 0.05

export function createSceneFrame() {
  return {
    towardEye: new Vector3(),
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    center: new Vector3(),
    relative: new Vector3(),
    target: new Vector3(),
    position: new Vector3(),
    distance: 0,
  }
}

/** Fit all eight corners into the unobstructed part of a perspective viewport. */
export function fitSceneBounds(
  bounds: SceneBounds,
  width: number,
  height: number,
  fov: number,
  direction: Point,
  insets: FrameInsets,
  minDistance: number,
  maxDistance: number,
  out = createSceneFrame(),
) {
  const { towardEye, forward, right, up, center, relative, target, position } = out
  towardEye.set(...direction).normalize()
  forward.copy(towardEye).negate()
  right.set(forward.y, -forward.x, 0).normalize()
  up.copy(right).cross(forward).normalize()
  center.set(
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  )
  const tanY = Math.tan((fov * Math.PI) / 360)
  const tanX = (tanY * width) / height
  const xMin = (2 * Math.min(insets.left, width * 0.4)) / width - 1
  const xMax = 1 - (2 * Math.min(insets.right, width * 0.8)) / width
  const yMin = (2 * Math.min(insets.bottom, height * 0.8)) / height - 1
  // The top inset passes through whole, however tall, and stops only where the open region above
  // the bottom inset would get thinner than the minimum span, so the frame never inverts.
  const yMax = Math.max(yMin + 2 * MIN_HALF_SPAN, 1 - (2 * insets.top) / height)
  const xMid = (xMin + xMax) / 2
  const yMid = (yMin + yMax) / 2
  const halfX = Math.max(MIN_HALF_SPAN, (xMax - xMin) / 2)
  const halfY = Math.max(MIN_HALF_SPAN, (yMax - yMin) / 2)
  let distance = minDistance
  for (let corner = 0; corner < 8; corner++) {
    relative
      .set(
        corner & 1 ? bounds.max[0] : bounds.min[0],
        corner & 2 ? bounds.max[1] : bounds.min[1],
        corner & 4 ? bounds.max[2] : bounds.min[2],
      )
      .sub(center)
    const x = relative.dot(right)
    const y = relative.dot(up)
    const z = relative.dot(towardEye)
    distance = Math.max(
      distance,
      (x / tanX + xMax * z) / halfX,
      (-x / tanX - xMin * z) / halfX,
      (y / tanY + yMax * z) / halfY,
      (-y / tanY - yMin * z) / halfY,
      z + 1,
    )
  }
  distance = Math.min(maxDistance, distance)
  target
    .copy(center)
    .addScaledVector(right, -xMid * distance * tanX)
    .addScaledVector(up, -yMid * distance * tanY)
  position.copy(target).addScaledVector(towardEye, distance)
  out.distance = distance
  return out
}
