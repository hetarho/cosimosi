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
}

/**
 * The web renderer host: a three.js WebGPURenderer (async init, auto WebGL2 fallback)
 * under R3F. The `.native` sibling hosts the same scene via react-native-webgpu. Slices
 * consume this — they never import `three`/R3F directly.
 */
export function UniverseCanvas({ children, dpr = [1, 2], fov = 55, forceWebGL = false }: UniverseCanvasProps) {
  return (
    <Canvas
      dpr={dpr}
      camera={{ fov, position: [0, 0, 90] }}
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(props as any),
          forceWebGL,
          antialias: true,
        })
        await renderer.init()
        return renderer
      }}
    >
      {children}
    </Canvas>
  )
}
