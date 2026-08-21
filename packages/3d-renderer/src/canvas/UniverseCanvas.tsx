import { Canvas, extend } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import { UNIVERSE_CANVAS_FAR } from '../backdrop-scale.ts'
import {
  DEFAULT_CANVAS_CAMERA_POSITION,
  DEFAULT_CANVAS_DPR,
  DEFAULT_CANVAS_FOV,
} from './canvas-defaults.ts'
import { resolveToneMapping, type ToneMappingKey } from './tone-mapping.ts'

// Register three/webgpu's catalogue with R3F (runtime side of jsx-elements.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

export interface UniverseCanvasProps {
  readonly children: ReactNode
  /**
   * devicePixelRatio (single or [min,max]). Defaults to the full range the adaptive sampler walks,
   * `[1, rendering.max_pixel_ratio]` — read from the cap rather than repeated, so raising the cap
   * can never leave a surface silently pinned to yesterday's ceiling.
   */
  readonly dpr?: number | [number, number]
  /** Vertical field of view. Defaults to the active skin's, the same value every mount passes. */
  readonly fov?: number
  /** Opaque scene clear color. The active sky owns this bare-night value. */
  readonly clearColor?: number
  /**
   * Far clip plane. It must clear the whole backdrop from the farthest framing — the layers nest as
   * camera zoom-out limit < StarField shell < SkySphere radius < this — or the sky is cut away
   * straight ahead and the scene opens onto a hole. (R3F's own default is 1000, too near for the
   * enclosing sky.)
   *
   * Code-owned, not a values.yaml scalar: it is one end of that nesting chain, and
   * `universe-render/backdrop-scale.test` walks the whole chain as one invariant — a knob a
   * deployment could turn independently is exactly what would break it.
   */
  readonly far?: number
  /**
   * Where the camera enters the world. Defaults to the straight-down bench framing; universe
   * surfaces pass `UNIVERSE_ARRIVAL_CAMERA_POSITION` so the lens's depth reads on arrival.
   */
  readonly cameraPosition?: readonly [number, number, number]
  /** Pin the WebGL2 fallback (skip WebGPU) — for parity testing. */
  readonly forceWebGL?: boolean
  /**
   * Clear to transparent instead of `clearColor`, so a DOM/CSS layer behind the canvas shows
   * through (the emotion-lit background sits under the scene, chrome floats over it).
   */
  readonly transparent?: boolean
  /**
   * The curve that lands accumulated light on the display. The scene ADDS light everywhere (stars,
   * the colour field, bloom), so without a curve a dense region clips per channel and reads white
   * regardless of what colour it was — see `tone-mapping.ts`. three's post pipeline reads this off
   * the renderer and folds it in after the bloom composite, so PostFX stays unaware of it.
   *
   * Defaults to `rendering.tone_mapping`, so every surface hosting a universe gets the shipped curve
   * without threading a prop; pass it only to deliberately render off-spec.
   */
  readonly toneMapping?: ToneMappingKey
  /** Exposure multiplier applied before the curve; defaults to `rendering.tone_mapping_exposure`. */
  readonly exposure?: number
}

/**
 * The web renderer host: a three.js WebGPURenderer under R3F. The `.native` sibling hosts the
 * same scene via react-native-webgpu. Slices consume this — they never import `three`/R3F directly.
 *
 * Init follows the standard R3F + WebGPU pattern (Anderson Mancini's r3f-webgpu starter): the
 * WebGPURenderer initializes asynchronously, so the canvas must render NOTHING until init
 * completes. We start with `frameloop="never"` and flip to `"always"` only inside
 * `renderer.init().then(...)`. Rendering before init leaves the renderer unsized and its render
 * targets created at the default 300×150, which never matches the real swapchain — every frame
 * then throws a WebGPU validation error ("resolve target size … does not match … attachments")
 * and the canvas goes black. `onCreated` applies the measured size up front, and antialiasing is
 * done in the post chain (PostFX) rather than as a swapchain MSAA buffer that fights the pipeline.
 */
export function UniverseCanvas({
  children,
  dpr = DEFAULT_CANVAS_DPR,
  fov = DEFAULT_CANVAS_FOV,
  far = UNIVERSE_CANVAS_FAR,
  cameraPosition = DEFAULT_CANVAS_CAMERA_POSITION,
  clearColor = 0x000000,
  forceWebGL = false,
  transparent = false,
  toneMapping = VALUES.rendering.toneMapping,
  exposure = VALUES.rendering.toneMappingExposure,
}: UniverseCanvasProps) {
  const [frameloop, setFrameloop] = useState<'never' | 'always'>('never')
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null)
  const pendingDispose = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Applied here rather than only in the `gl` factory (which R3F runs once) so the curve can change
  // without tearing down the WebGPU device. three's RenderPipeline diffs `renderer.toneMapping`
  // every frame and rebuilds its output node when it moves, so assignment is all that is needed.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.toneMapping = resolveToneMapping(toneMapping)
    renderer.toneMappingExposure = exposure
  }, [toneMapping, exposure, frameloop])

  // Releasing the device is ours to do: R3F's unmount path (`unmountComponentAtNode`) only reaches
  // for `renderLists?.dispose()` and `forceContextLoss?.()`, both WebGL-shaped and both absent from
  // WebGPURenderer, so its optional chaining quietly no-ops and the device outlives the route.
  //
  // The dispose is deferred one macrotask instead of running inline, because R3F keeps its root —
  // and with it `state.gl` — across StrictMode's simulated unmount/remount, and re-`configure` skips
  // the `gl` factory whenever a renderer already exists. Disposing inline would therefore hand the
  // dev build a disposed device on remount. A real unmount has no remount to cancel the timer.
  useEffect(() => {
    if (pendingDispose.current !== null) {
      clearTimeout(pendingDispose.current)
      pendingDispose.current = null
    }
    return () => {
      pendingDispose.current = setTimeout(() => {
        pendingDispose.current = null
        const renderer = rendererRef.current
        rendererRef.current = null
        renderer?.dispose()
      }, 0)
    }
  }, [])

  return (
    <Canvas
      frameloop={frameloop}
      dpr={dpr}
      camera={{ fov, far, position: cameraPosition as [number, number, number] }}
      style={transparent ? { background: 'transparent' } : undefined}
      onCreated={(state) => state.setSize(state.size.width, state.size.height)}
      gl={(props) => {
        const renderer = new THREE.WebGPURenderer({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(props as any),
          forceWebGL,
          // AA lives in the post chain (PostFX), not the swapchain: a built-in MSAA color buffer
          // fights the post pipeline's resolve target. This matches the standard WebGPU-in-R3F setup.
          antialias: false,
        })
        // R3F already requests an alpha context (default `alpha: true` → premultiplied swapchain),
        // so transparency needs only a zero-alpha clear: the DOM background behind the canvas then
        // shows through the scene's empty space, and the bloom pipeline preserves the per-pixel alpha.
        renderer.setClearColor(transparent ? 0x000000 : clearColor, transparent ? 0 : 1)
        renderer.toneMapping = resolveToneMapping(toneMapping)
        renderer.toneMappingExposure = exposure
        rendererRef.current = renderer
        // Start the render loop only once WebGPU is ready (see the frameloop note above).
        void renderer.init().then(() => setFrameloop('always'))
        return renderer
      }}
    >
      {children}
    </Canvas>
  )
}
