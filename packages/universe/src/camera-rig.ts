// Navigation-rig presentation constants. They shape interaction feel, not product
// behavior, so they stay code-level; one moves to a values.yaml rendering.camera.* key
// only when it needs cross-surface tuning.

/**
 * How near and how far any camera in the universe may travel. Split out of the rig below because
 * the demo/design inspection controls (`CameraControls`) wear the same envelope without the rest of
 * the rig — one source for both, so no surface can quietly hold a zoom limit of its own.
 */
export const UNIVERSE_CAMERA_ENVELOPE = {
  minDistance: 8,
  /** Zoom-out limit. Stays inside the sky sphere and the star shell, so pulling all the way back
   *  still shows a wrapped sky rather than the scene from outside its own backdrop. */
  maxDistance: 420,
} as const

/**
 * Where a universe surface's camera ENTERS the world, passed to the canvas host by every surface
 * that shows the real (or demo/empty) universe. Elevated, never on the z axis: the universe is an
 * origin-centered lens whose depth is its z spread ([C5][V0]), and a straight-down entry is the one
 * direction that projects that spread away entirely. ~90 world units out (the distance the
 * straight-down bench default frames the field at), risen ~28° off the flat. Benches and staged
 * scenes keep the canvas's own straight-down default instead — their content is authored against it.
 */
export const UNIVERSE_ARRIVAL_CAMERA_POSITION: readonly [number, number, number] = [0, -80, 42]

export const UNIVERSE_CAMERA_RIG = {
  ...UNIVERSE_CAMERA_ENVELOPE,
  /** Camera-to-node distance a focus/fly glide lands at — scaled with force_sim.link_distance so a
   *  focused star fills a comparable share of the frame as the layout's spacing changes. */
  framingDistance: 40,
  /** Exp-damp responsiveness per glide mode (higher = snappier). */
  glideLambda: { focusing: 4, flying: 2.2 },
  arriveEpsilon: 0.35,
  /** A glide that can't settle inside the arrival shell within this many seconds force-arrives,
   *  so a chase of a still-drifting target never strands the rig (normal glides land in ~3s). */
  arriveTimeoutSeconds: 6,
  /**
   * How far off the flat the pinned view may tilt, in radians — one allowance for rising above the
   * flat and a separate, smaller one for dipping below it.
   *
   * The z axis is the universe's own up — memories fill the origin-centered lens and their gists
   * float in the offset copy above ([V9]) — so a near-level camera is the pose where
   * that separation reads as height rather than as scatter. The two halves are unequal because the
   * two directions are not worth the same: rising looks DOWN onto the lens the memories fill and
   * across at the gists above it, which is the view that shows the depth, while dipping only puts
   * the near stars between the eye and everything else. Both stay small enough that the horizon
   * never leaves the frame.
   */
  pinnedTiltUp: (20 * Math.PI) / 180,
  pinnedTiltDown: (10 * Math.PI) / 180,
  /**
   * Where in that allowance the pinned view OPENS. Dead level (0) would put the eye in the lens's
   * own mid-plane, where the band-deep cloud collapses to a line and the z the layout genuinely
   * spreads ([C5]) is invisible; a modest rise shows the depth on arrival while leaving
   * tilt to spend in both directions.
   */
  pinnedOpeningElevation: (12 * Math.PI) / 180,
  /** Exp-damp responsiveness of the return to the pinned pose after a glide lets the camera go. */
  pinnedReturnLambda: 2.6,
  /** Trackball-equivalent feel for the pinned orbit: slower than a free tumble, because every drag
   *  here moves a constrained camera around one fixed centre rather than spinning the whole scene. */
  pinnedRotateSpeed: 0.7,
  pinnedDampingFactor: 0.12,
} as const
