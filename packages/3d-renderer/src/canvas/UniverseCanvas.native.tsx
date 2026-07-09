import type { ReconcilerRoot } from '@react-three/fiber'
import { createRoot, events, extend, unmountComponentAtNode } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PixelRatio } from 'react-native'
import { Canvas, type CanvasRef } from 'react-native-webgpu'
import * as THREE from 'three/webgpu'
import type { UniverseCanvasProps } from './UniverseCanvas.tsx'

export type { UniverseCanvasProps } from './UniverseCanvas.tsx'

// Register three/webgpu's catalogue with R3F (runtime side of jsx-elements.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

/**
 * The native renderer host, hosting the SAME shared R3F scene as the web
 * `UniverseCanvas.tsx`. R3F's web `<Canvas>` can't run on React Native — it needs a DOM
 * element + `ResizeObserver` (react-use-measure) that the RN runtime lacks. So on native we
 * follow react-native-webgpu's prescribed integration: drive the scene through a manual R3F
 * root (`createRoot(...).configure(...)`) over react-native-webgpu's own canvas surface,
 * with an explicit `size` (no measurement) and a `present()` after each frame. The public
 * props stay identical to web, so slices consume `<UniverseCanvas>` the same way.
 */
// `transparent` (shared prop) is web-only for now: no native call site passes it, so this host
// deliberately does not implement the zero-alpha clear. Wire it here if a native surface ever
// needs a DOM/CSS backdrop behind the scene.
export function UniverseCanvas({
  children,
  dpr = [1, 2],
  fov = 55,
  forceWebGL = false,
}: UniverseCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = useRef<ReconcilerRoot<any> | null>(null)
  const canvasRef = useRef<CanvasRef>(null)
  const renderer = useRef<THREE.WebGPURenderer | null>(null)

  // The scene is re-rendered into the root on every prop change (below); memoize nothing here.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = canvasRef.current?.getContext('webgpu') as any
    if (!context) return

    // context.canvas is a DOM-canvas-shaped shim from react-native-webgpu; the mobile tsconfig
    // has no DOM lib, so treat it loosely. Size its backing store to the device pixel ratio,
    // capped by the app's rendering.max_pixel_ratio (passed in via dpr), then keep R3F at dpr 1
    // so it renders 1:1 into that already-scaled buffer.
    const canvas = context.canvas
    const maxDpr = Array.isArray(dpr) ? dpr[1] : dpr
    const pixelRatio = Math.min(PixelRatio.get(), maxDpr)
    canvas.width = canvas.clientWidth * pixelRatio
    canvas.height = canvas.clientHeight * pixelRatio
    const size = { top: 0, left: 0, width: canvas.clientWidth, height: canvas.clientHeight }

    if (!root.current) root.current = createRoot(canvas)
    root.current.configure({
      size,
      events,
      camera: { fov, position: [0, 0, 90] },
      // Async gl factory: R3F awaits it before starting the render loop, so the WebGPU
      // backend is initialized before the first render() (a bare renderer would throw
      // "render() called before the backend is initialized").
      gl: async () => {
        const gpuRenderer = new THREE.WebGPURenderer({
          canvas,
          context,
          forceWebGL,
          antialias: true,
        })
        renderer.current = gpuRenderer
        await gpuRenderer.init()
        // react-native-webgpu needs an explicit present() after each on-screen frame (the web
        // host gets this from the browser compositor). Wrap render() to present ONLY when
        // drawing to the surface (getRenderTarget() === null) — a frame with post-processing
        // (PostFX/bloom) issues several offscreen render-target passes before the final
        // composite, and presenting mid-pipeline would flush an unrendered surface (blank
        // screen). This presents exactly once per frame, after the composite.
        const renderFrame = gpuRenderer.render.bind(gpuRenderer)
        gpuRenderer.render = (scene: THREE.Scene, camera: THREE.Camera) => {
          renderFrame(scene, camera)
          if (gpuRenderer.getRenderTarget() === null) context.present()
        }
        return gpuRenderer
      },
      frameloop: 'always',
      dpr: 1,
    })
    root.current.render(children)

    return () => {
      unmountComponentAtNode(canvas)
      root.current = null
      // The manual root doesn't own the factory-created renderer, so dispose the WebGPU
      // device/pipelines here or a remount (StrictMode / dpr·fov·forceWebGL change) leaks them.
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [children, dpr, fov, forceWebGL])

  return <Canvas ref={canvasRef} style={styles.fill} />
}

// Inline to avoid importing react-native's StyleSheet type surface into this thin host.
const styles = { fill: { flex: 1 } } as const
