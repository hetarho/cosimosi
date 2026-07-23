import { Canvas, extend } from '@react-three/fiber'
import { useState, type ReactNode } from 'react'
import * as THREE from 'three/webgpu'

// Register three/webgpu's catalogue with R3F (runtime side of jsx-elements.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

export interface UniverseCanvasProps {
  readonly children: ReactNode
  /** devicePixelRatio (single or [min,max]); the app caps it from rendering.max_pixel_ratio. */
  readonly dpr?: number | [number, number]
  readonly fov?: number
  /** Pin the WebGL2 fallback (skip WebGPU) — for parity testing. */
  readonly forceWebGL?: boolean
  /**
   * Clear to transparent instead of the scene background, so a DOM/CSS layer behind the
   * canvas shows through (the emotion-lit background sits under the scene, chrome floats
   * over it). The scene must also omit the `<Background>` layer for this to read.
   */
  readonly transparent?: boolean
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
  dpr = [1, 2],
  fov = 55,
  forceWebGL = false,
  transparent = false,
}: UniverseCanvasProps) {
  const [frameloop, setFrameloop] = useState<'never' | 'always'>('never')
  return (
    <Canvas
      frameloop={frameloop}
      dpr={dpr}
      camera={{ fov, position: [0, 0, 90] }}
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
        if (transparent) renderer.setClearColor(0x000000, 0)
        // Start the render loop only once WebGPU is ready (see the frameloop note above).
        void renderer.init().then(() => setFrameloop('always'))
        return renderer
      }}
    >
      {children}
    </Canvas>
  )
}
