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
   * How far off the flat the pinned view may tilt, in radians — **each way**, above the flat and
   * below it, so the whole allowance is twice this and the pinned view opens in the middle of it.
   *
   * The z axis is the universe's own up — memories lie in the hippocampus band and their gists float
   * in the neocortex band above ([V9]) — so a level camera is the one pose where that separation
   * reads as height rather than as scatter. The allowance is enough to feel the depth between the two
   * bands from slightly above or below, and small enough that the horizon never leaves the frame.
   */
  pinnedTilt: (15 * Math.PI) / 180,
  /** Exp-damp responsiveness of the return to the pinned pose after a glide lets the camera go. */
  pinnedReturnLambda: 2.6,
  /** Trackball-equivalent feel for the pinned orbit: slower than a free tumble, because every drag
   *  here moves a constrained camera around one fixed centre rather than spinning the whole scene. */
  pinnedRotateSpeed: 0.7,
  pinnedDampingFactor: 0.12,
} as const
