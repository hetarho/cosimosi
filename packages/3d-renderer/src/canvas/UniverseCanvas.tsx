import { Canvas, extend } from '@react-three/fiber'
import type { ReactNode } from 'react'
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
 * The web renderer host: a three.js WebGPURenderer (async init, auto WebGL2 fallback)
 * under R3F. The `.native` sibling hosts the same scene via react-native-webgpu. Slices
 * consume this — they never import `three`/R3F directly.
 */
export function UniverseCanvas({
  children,
  dpr = [1, 2],
  fov = 55,
  forceWebGL = false,
  transparent = false,
}: UniverseCanvasProps) {
  return (
    <Canvas
      dpr={dpr}
      camera={{ fov, position: [0, 0, 90] }}
      style={transparent ? { background: 'transparent' } : undefined}
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(props as any),
          forceWebGL,
          antialias: true,
        })
        await renderer.init()
        // R3F already requests an alpha context (default `alpha: true` → premultiplied
        // swapchain), so transparency needs only a zero-alpha clear: the DOM background
        // behind the canvas then shows through the scene's empty space, and the bloom
        // pipeline preserves the per-pixel alpha. Leaving the constructor params untouched
        // keeps opaque (default) consumers byte-for-byte unchanged.
        if (transparent) renderer.setClearColor(0x000000, 0)
        return renderer
      }}
    >
      {children}
    </Canvas>
  )
}
