/**
 * The fps→pixel-ratio walk, as a pure function so the hysteresis is testable without a GPU.
 *
 * Pixel ratio is the quality lever this scene actually has: shading cost scales with its square,
 * and `frameloop="demand"` is off the table because the ambient sky and twinkle animation ARE the
 * product (code-review/12, Questions). drei's `PerformanceMonitor`/`AdaptiveDpr` would be the
 * stock answer, but drei's WebGPU line is unfinished — so the walk is hand-rolled here, keeping
 * drei's flip-flop idea because the naive version of this oscillates (see `sampleAdaptiveDpr`).
 */

/** The floor: one framebuffer pixel per layout pixel. Below it the scene reads as blurred, not cheap. */
export const ADAPTIVE_DPR_FLOOR = 1

export interface AdaptiveDprThresholds {
  readonly maxPixelRatio: number
  /** How long one fps average runs before it may move the ratio. */
  readonly windowSeconds: number
  /** Below this average the window steps down; above `upFps` it steps up; between, nothing moves. */
  readonly downFps: number
  readonly upFps: number
  readonly step: number
  /** Direction reversals allowed before the walk settles for good. */
  readonly maxFlipflops: number
}

export interface AdaptiveDprSampler {
  /** The open window's accumulator. */
  windowSeconds: number
  windowFrames: number
  /** The last step's direction: -1 down, +1 up, 0 none yet. */
  lastDirection: number
  /** How many times the walk has reversed direction. */
  flipflops: number
  /** Once set, the walk has found the ratio this device holds and stops moving it. */
  settled: boolean
}

export function createAdaptiveDprSampler(): AdaptiveDprSampler {
  return { windowSeconds: 0, windowFrames: 0, lastDirection: 0, flipflops: 0, settled: false }
}

/**
 * Feed one frame's delta plus the ratio actually in force. Returns the ratio to apply when a
 * closed window called for a step, and `null` on every other frame — which is almost all of them.
 * Only that return value may cross into React state; the samples themselves must not (§3.2).
 *
 * The step is computed from `currentPixelRatio` rather than from a remembered one, so the applied
 * ratio stays the single source of truth. A host is free to clamp what it was handed — native
 * resolves the range against the device's own ratio — and the next window simply reads what that
 * produced. A sampler holding its own idea of the ratio would instead drift above the clamp and
 * spend several windows walking back down to a step the device could actually see.
 *
 * **Why the dead band is not enough.** Lowering the ratio is what raises the frame rate, so a
 * device that reads 44 fps at ratio 2 can read 58 at 1.75 — above `upFps` — climb back to 2, fall
 * to 44, and resize forever. No measurement separates it from a device with real headroom, because
 * vsync caps both at 60. So the walk counts direction REVERSALS and settles after `maxFlipflops`,
 * always on the lower of the two ratios: refuse the reversing step up, take the reversing step
 * down. Settling is for the life of the sampler — a scene remount starts a fresh one.
 */
export function sampleAdaptiveDpr(
  sampler: AdaptiveDprSampler,
  deltaSeconds: number,
  currentPixelRatio: number,
  thresholds: AdaptiveDprThresholds,
): number | null {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return null
  // A delta longer than the whole window is not a slow frame, it is a gap — a hidden tab resuming,
  // a backgrounded app foregrounding, a shader compile stalling the loop. Averaging it in would
  // read as ~1 fps and drop the ratio for something that already ended, so the window restarts.
  if (deltaSeconds >= thresholds.windowSeconds) {
    sampler.windowSeconds = 0
    sampler.windowFrames = 0
    return null
  }
  sampler.windowSeconds += deltaSeconds
  sampler.windowFrames += 1
  if (sampler.windowSeconds < thresholds.windowSeconds) return null

  const fps = sampler.windowFrames / sampler.windowSeconds
  sampler.windowSeconds = 0
  sampler.windowFrames = 0

  if (sampler.settled) return null
  if (!Number.isFinite(currentPixelRatio) || currentPixelRatio <= 0) return null

  const direction = fps < thresholds.downFps ? -1 : fps > thresholds.upFps ? 1 : 0
  if (direction === 0) return null

  if (sampler.lastDirection !== 0 && direction !== sampler.lastDirection) {
    sampler.flipflops += 1
    if (sampler.flipflops >= thresholds.maxFlipflops) {
      sampler.settled = true
      // Settle on a ratio the device has actually held: a reversing step UP is the one that would
      // put it back where it just failed, so it is refused.
      if (direction > 0) return null
    }
  }

  const next = Math.min(
    Math.max(currentPixelRatio + direction * thresholds.step, ADAPTIVE_DPR_FLOOR),
    thresholds.maxPixelRatio,
  )
  // A step that hit a bound moved nothing, so it is not a direction the walk took.
  if (next === currentPixelRatio) return null
  sampler.lastDirection = direction
  return next
}
