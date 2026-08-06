import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

import { VALUES } from '@cosimosi/config'

import {
  createAdaptiveDprSampler,
  sampleAdaptiveDpr,
  type AdaptiveDprSampler,
  type AdaptiveDprThresholds,
} from './adaptive-dpr.ts'

export interface AdaptiveDprLayerProps {
  /**
   * Where a closed window's step lands: the HOST's pixel-ratio ceiling, which the shell owns in
   * state and passes back down as the canvas `dpr` prop. Must be stable across renders.
   *
   * Writing R3F's `setDpr` from in here instead would not survive. Both hosts take a `dpr` prop,
   * and R3F's `configure` — which `<Canvas>` re-runs on every render — resets the store whenever
   * `viewport.dpr` disagrees with what that prop resolves to. The native host's live-config pass
   * does the same. So the step has to go up to the shell and re-enter as a prop; that also keeps
   * it on the in-place backing-store resize path and away from the device effect.
   */
  readonly onPixelRatio: (pixelRatio: number) => void
  /** Ceiling the walk climbs back to; defaults to `rendering.max_pixel_ratio`. */
  readonly maxPixelRatio?: number
}

/**
 * Adaptive quality: sample the frame rate over a window and step the pixel ratio between
 * `ADAPTIVE_DPR_FLOOR` and the cap, so a device that cannot hold the budget renders fewer pixels
 * instead of dropping frames. The decision itself is pure (`adaptive-dpr.ts`); this is only its
 * R3F binding.
 *
 * Per-frame samples stay in a ref — a sustained-window STEP may reach React, a sample never
 * may (§3.2).
 */
export function AdaptiveDprLayer({
  onPixelRatio,
  maxPixelRatio = VALUES.rendering.maxPixelRatio,
}: AdaptiveDprLayerProps) {
  const sampler = useRef<AdaptiveDprSampler>(createAdaptiveDprSampler())

  const thresholds = useMemo<AdaptiveDprThresholds>(
    () => ({
      maxPixelRatio,
      windowSeconds: VALUES.rendering.adaptiveDprWindowSeconds,
      downFps: VALUES.rendering.adaptiveDprDownFps,
      upFps: VALUES.rendering.adaptiveDprUpFps,
      step: VALUES.rendering.adaptiveDprStep,
      maxFlipflops: VALUES.rendering.adaptiveDprMaxFlipflops,
    }),
    [maxPixelRatio],
  )

  useFrame((state, delta) => {
    // The store's dpr is the ratio actually in force — resolved by the host against the device
    // (`devicePixelRatio` on web, `PixelRatio.get()` on native) and clamped by it. Read it per
    // frame rather than remembering one, so a host-side clamp is never argued with.
    const next = sampleAdaptiveDpr(sampler.current, delta, state.viewport.dpr, thresholds)
    if (next !== null) onPixelRatio(next)
  })

  return null
}
