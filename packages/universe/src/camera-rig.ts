// Navigation-rig presentation constants. They shape interaction feel, not product
// behavior, so they stay code-level; one moves to a values.yaml rendering.camera.* key
// only when it needs cross-surface tuning.
export const UNIVERSE_CAMERA_RIG = {
  minDistance: 6,
  maxDistance: 220,
  /** Camera-to-node distance a focus/fly glide lands at. */
  framingDistance: 26,
  /** Exp-damp responsiveness per glide mode (higher = snappier). */
  glideLambda: { focusing: 4, flying: 2.2 },
  arriveEpsilon: 0.35,
  /** A glide that can't settle inside the arrival shell within this many seconds force-arrives,
   *  so a chase of a still-drifting target never strands the rig (normal glides land in ~3s). */
  arriveTimeoutSeconds: 6,
} as const
