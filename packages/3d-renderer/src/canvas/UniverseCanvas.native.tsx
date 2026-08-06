import type { ReconcilerRoot, RootState } from '@react-three/fiber'
import { createRoot, events, extend, unmountComponentAtNode } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { AppState, PixelRatio, type AppStateStatus } from 'react-native'
import { Canvas, type CanvasRef } from 'react-native-webgpu'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import { UNIVERSE_CANVAS_FAR } from '../backdrop-scale.ts'
import type { UniverseCanvasProps } from './UniverseCanvas.tsx'
import { DEFAULT_CANVAS_DPR, DEFAULT_CANVAS_FOV } from './canvas-defaults.ts'
import { resolveToneMapping } from './tone-mapping.ts'

export type { UniverseCanvasProps } from './UniverseCanvas.tsx'

// Register three/webgpu's catalogue with R3F (runtime side of jsx-elements.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

/**
 * Resolve the `dpr` prop to a single number against the device's own ratio.
 *
 * R3F would otherwise do this itself, but its `calculateDpr` reads
 * `window.devicePixelRatio` — undefined under React Native, where it falls back to a flat 2 and
 * ignores the cap's lower bound. So native resolves the range here and hands R3F a number.
 */
function resolvePixelRatio(dpr: number | [number, number]): number {
  if (!Array.isArray(dpr)) return dpr
  const [min, max] = dpr
  return Math.min(Math.max(min, PixelRatio.get()), max)
}

/**
 * Whether the render loop should be running for a given app state.
 *
 * The web host inherits rAF's hidden-tab pause for free; React Native has no such thing, so a
 * backgrounded app would keep paying for the full scene — every layer, the post chain, and the
 * inline sim pump that rides the same loop (`FrameTick`) — with nothing on screen.
 *
 * `currentState` reads `null` before RN has resolved it (Android cold start). That is a not-yet,
 * not a background: pausing on it would leave a cold-started app blank until the first change event.
 */
function frameloopFor(status: AppStateStatus | null): 'always' | 'never' {
  return status === null || status === 'active' ? 'always' : 'never'
}

/** The live values the device effect must not re-key on — see the effect split below. */
type LiveConfig = Pick<
  Required<UniverseCanvasProps>,
  'dpr' | 'fov' | 'far' | 'clearColor' | 'toneMapping' | 'exposure'
>

/**
 * The native renderer host, hosting the SAME shared R3F scene as the web
 * `UniverseCanvas.tsx`. R3F's web `<Canvas>` can't run on React Native — it needs a DOM
 * element + `ResizeObserver` (react-use-measure) that the RN runtime lacks. So on native we
 * follow react-native-webgpu's prescribed integration: drive the scene through a manual R3F
 * root (`createRoot(...).configure(...)`) over react-native-webgpu's own canvas surface,
 * with an explicit `size` (no measurement) and a `present()` after each frame. The public
 * props stay identical to web, so slices consume `<UniverseCanvas>` the same way.
 *
 * Because the root is manual, this host — not R3F — owns the device lifecycle, and it is split
 * across three effects that must stay separate:
 *
 *   1. **device** — keyed on `forceWebGL` alone, the one prop that picks a different GPU backend.
 *      Brings up the surface context, the R3F root and the `WebGPURenderer`, and disposes them.
 *   2. **children** — renders the scene into the existing root. A parent re-render costs this and
 *      nothing else.
 *   3. **live config** — writes every other prop onto the already-running root/renderer.
 *
 * Anything that leaks from 2 or 3 into 1's dependency array tears the WebGPU device down and
 * rebuilds it mid-session: a frame-long black canvas, and one fresh native surface context per
 * change (`getContext` mints a new `GPUCanvasContext` on every call).
 */
// `transparent` (shared prop) is web-only for now: no native call site passes it, so this host
// deliberately does not implement the zero-alpha clear. Wire it here if a native surface ever
// needs a DOM/CSS backdrop behind the scene.
export function UniverseCanvas({
  children,
  dpr = DEFAULT_CANVAS_DPR,
  fov = DEFAULT_CANVAS_FOV,
  far = UNIVERSE_CANVAS_FAR,
  clearColor = 0x000000,
  forceWebGL = false,
  toneMapping = VALUES.rendering.toneMapping,
  exposure = VALUES.rendering.toneMappingExposure,
}: UniverseCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = useRef<ReconcilerRoot<any> | null>(null)
  const canvasRef = useRef<CanvasRef>(null)
  const renderer = useRef<THREE.WebGPURenderer | null>(null)
  const r3fState = useRef<RootState | null>(null)

  const live = useRef<LiveConfig>({ dpr, fov, far, clearColor, toneMapping, exposure })
  live.current = { dpr, fov, far, clearColor, toneMapping, exposure }

  // Applied both from the live-config effect and from `onCreated`: the root's Provider mounts on a
  // microtask after `render()`, so props that move between the device effect and that callback
  // would otherwise be dropped on the floor.
  const applyLiveConfig = useRef(() => {
    const { dpr: liveDpr, fov: liveFov, far: liveFar, ...tone } = live.current
    const state = r3fState.current
    if (state) {
      const camera = state.camera as THREE.PerspectiveCamera
      if (camera.isPerspectiveCamera) {
        camera.fov = liveFov
        camera.far = liveFar
        camera.updateProjectionMatrix()
      }
      // The store's dpr is the supported resize seam: R3F's subscription answers it with
      // `gl.setPixelRatio` + `gl.setSize`, which resizes the canvas backing store in place (the
      // native `GPUCanvasContext` picks the new `canvas.width`/`height` up on the next frame).
      // Writing `canvas.width` by hand here instead would be undone by that same subscription.
      state.setDpr(resolvePixelRatio(liveDpr))
    }
    const gpuRenderer = renderer.current
    if (!gpuRenderer) return
    // three's RenderPipeline diffs these off the renderer every frame, so assignment is the whole
    // update — same hot-apply the web host uses for tone mapping. Native also re-clears here
    // because its clear colour is skin-driven and must follow a re-skin without a new device.
    gpuRenderer.setClearColor(tone.clearColor, 1)
    gpuRenderer.toneMapping = resolveToneMapping(tone.toneMapping)
    gpuRenderer.toneMappingExposure = tone.exposure
  })

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = canvasRef.current?.getContext('webgpu') as any
    if (!context) return

    // context.canvas is a DOM-canvas-shaped shim from react-native-webgpu; the mobile tsconfig
    // has no DOM lib, so treat it loosely.
    const canvas = context.canvas
    const initial = live.current
    const reconciler = createRoot(canvas)
    root.current = reconciler
    reconciler.configure({
      // No measurement on native: the shim reports the surface's own bounds, and R3F multiplies
      // this logical size by the dpr below to size the drawing buffer.
      size: { top: 0, left: 0, width: canvas.clientWidth, height: canvas.clientHeight },
      dpr: resolvePixelRatio(initial.dpr),
      events,
      camera: { fov: initial.fov, far: initial.far, position: [0, 0, 90] },
      // Async gl factory: R3F awaits it before starting the render loop, so the WebGPU
      // backend is initialized before the first render() (a bare renderer would throw
      // "render() called before the backend is initialized").
      gl: async () => {
        const gpuRenderer = new THREE.WebGPURenderer({
          canvas,
          context,
          forceWebGL,
          // Same choice as the web host, for the same reason: AA lives in the post chain (PostFX),
          // not the swapchain. A built-in MSAA color buffer fights the post pipeline's resolve
          // target, and both hosts mount PostFX — so asking for MSAA here bought a multisampled
          // buffer the composite never resolves from. Native is also the platform least able to
          // afford paying for it twice.
          antialias: false,
        })
        gpuRenderer.setClearColor(initial.clearColor, 1)
        gpuRenderer.toneMapping = resolveToneMapping(initial.toneMapping)
        gpuRenderer.toneMappingExposure = initial.exposure
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
      onCreated: (state) => {
        r3fState.current = state
        applyLiveConfig.current()
        // A device brought up while the app is already backgrounded must not start rendering; the
        // subscription below only sees CHANGES, so the initial state is read here.
        state.setFrameloop(frameloopFor(AppState.currentState))
      },
    })

    return () => {
      unmountComponentAtNode(canvas)
      root.current = null
      r3fState.current = null
      // The manual root doesn't own the factory-created renderer — R3F's own teardown only calls
      // WebGL-shaped methods (`renderLists?.dispose()`, `forceContextLoss?.()`), neither of which
      // exists on WebGPURenderer — so the device is ours to release, or a remount (StrictMode, a
      // forceWebGL flip) leaks it. The ref is cleared before disposing so a second cleanup can
      // never dispose the same device twice.
      const disposing = renderer.current
      renderer.current = null
      disposing?.dispose()
    }
  }, [forceWebGL])

  useEffect(() => {
    root.current?.render(children)
  }, [children])

  useEffect(() => {
    applyLiveConfig.current()
  }, [dpr, fov, far, clearColor, toneMapping, exposure])

  // Mount-scoped and imperative: pausing goes straight to the running root, so backgrounding costs
  // no React render and cannot reach the device effect. Keyed on nothing, so a device rebuilt
  // mid-session (a backend switch) is picked up through the ref rather than by re-subscribing.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      r3fState.current?.setFrameloop(frameloopFor(status))
    })
    return () => subscription.remove()
  }, [])

  return <Canvas ref={canvasRef} style={styles.fill} />
}

// Inline to avoid importing react-native's StyleSheet type surface into this thin host.
const styles = { fill: { flex: 1 } } as const
