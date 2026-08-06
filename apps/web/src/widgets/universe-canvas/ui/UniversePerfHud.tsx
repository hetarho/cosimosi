import { Suspense, lazy } from 'react'

/**
 * The measurement HUD for the universe scene — frame time, GPU/CPU split, draw calls, triangles.
 *
 * `r3f-webgpu-perf` is the one maintained R3F perf panel that reads a WebGPU renderer (r3f-perf and
 * drei's monitors are WebGL-shaped); it is a devDependency, so the import must not survive into a
 * production bundle. `import.meta.env.DEV` is a build-time constant, so the whole branch — and with
 * it the dynamic import — is eliminated from the production build rather than merely never taken.
 * Whether it MOUNTS is the caller's decision, taken against the diagnostics flag outside the canvas
 * (React context does not cross the R3F reconciler).
 */
const Perf = import.meta.env.DEV
  ? lazy(() => import('r3f-webgpu-perf').then((module) => ({ default: module.Perf })))
  : null

/** Whether the HUD exists in this build at all — false in every production bundle. */
export const PERF_HUD_AVAILABLE = Perf !== null

/**
 * Mounts as a scene child: the panel spins up its own `react-dom/client` root rather than
 * rendering DOM through the R3F reconciler, so sitting inside the canvas is exactly where it wants
 * to be — that is how it reaches `useThree`/`useFrame` for the numbers.
 */
export function UniversePerfHud() {
  if (!Perf) return null
  return (
    <Suspense fallback={null}>
      <Perf position="bottom-left" showVRAM />
    </Suspense>
  )
}
