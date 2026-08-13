// Pure pinned-camera geometry for the navigation rig, extracted so the envelope the pinned view
// promises — z is up, the tilt off the flat is bounded, the distance stays inside the zoom limits —
// is unit-testable (the rig itself only runs inside R3F's useFrame).
//
// The pinned camera is described by its offset from whatever it is orbiting, in the universe's own
// axes: an azimuth AROUND z, an elevation ABOVE the flat, and a radius. Reading a camera position as
// that offset and writing an offset back out as a position are the two halves of the return glide,
// and clamping happens in between — in the one representation where "a few degrees off flat" is a
// single signed number rather than a rotation to decompose.

export interface Vec3Like {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface MutableVec3 {
  x: number
  y: number
  z: number
}

export interface PinnedOffset {
  /** Rotation around the world z axis, in radians. Free — the viewer chooses where they stand. */
  azimuth: number
  /** Angle above the flat, in radians — negative below it. Bounded by the envelope's two tilts. */
  elevation: number
  /** Distance from the orbited centre. Bounded by the zoom envelope. */
  radius: number
}

export interface PinnedEnvelope {
  /** Largest rise above the flat the pinned view allows, in radians. */
  readonly maxTiltUp: number
  /** Largest dip below the flat it allows, in radians — a positive number, like the rise. */
  readonly maxTiltDown: number
  readonly minDistance: number
  readonly maxDistance: number
}

export function createPinnedOffset(): PinnedOffset {
  return { azimuth: 0, elevation: 0, radius: 0 }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Read where a camera stands relative to a centre, already clamped into the pinned envelope.
 *
 * Writes into `out` — called every frame, so no per-frame allocation (§3.3). A camera sitting
 * exactly on the centre has no direction to preserve; it is given the -y approach, which looks
 * along +y with z up, rather than a degenerate zero offset.
 */
export function readPinnedOffset(
  out: PinnedOffset,
  camera: Vec3Like,
  center: Vec3Like,
  envelope: PinnedEnvelope,
): PinnedOffset {
  const dx = camera.x - center.x
  const dy = camera.y - center.y
  const dz = camera.z - center.z
  const flat = Math.hypot(dx, dy)
  const radius = Math.hypot(flat, dz)
  if (radius < 1e-6) {
    out.azimuth = -Math.PI / 2
    out.elevation = 0
    out.radius = envelope.minDistance
    return out
  }
  out.azimuth = Math.atan2(dy, dx)
  out.elevation = clamp(Math.atan2(dz, flat), -envelope.maxTiltDown, envelope.maxTiltUp)
  out.radius = clamp(radius, envelope.minDistance, envelope.maxDistance)
  return out
}

/** Write the world position an offset puts the camera at. Mutates `out` (per-frame, no allocation). */
export function pinnedCameraPosition(
  out: MutableVec3,
  center: Vec3Like,
  offset: PinnedOffset,
): MutableVec3 {
  const flat = Math.cos(offset.elevation) * offset.radius
  out.x = center.x + Math.cos(offset.azimuth) * flat
  out.y = center.y + Math.sin(offset.azimuth) * flat
  out.z = center.z + Math.sin(offset.elevation) * offset.radius
  return out
}
