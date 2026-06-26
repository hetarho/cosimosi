// Platform layer (three allowed). Builds the WebGPU renderer R3F's <Canvas gl={…}>
// consumes. WebGPURenderer transparently falls back to a WebGL2 backend where
// WebGPU is unavailable (Architecture §3.1), so callers get one code path.
import { useThree, type GLProps } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

type RendererParams = ConstructorParameters<typeof THREE.WebGPURenderer>[0]
type RendererOverrides = Partial<RendererParams>

/** Thrown when NEITHER WebGPU nor the WebGL2 fallback could initialize —
 *  the canvas error boundary keys on this to show "이 브라우저/기기에서는 우주를
 *  그릴 수 없어요" guidance instead of a generic retry. */
export class RendererUnavailableError extends Error {
  constructor(cause: unknown) {
    super('neither WebGPU nor WebGL2 renderer could be initialized')
    this.name = 'RendererUnavailableError'
    this.cause = cause
  }
}

/** Async factory for R3F's `gl` prop. WebGPURenderer requires `await init()` before
 *  first render (§3.1); R3F awaits the returned promise. R3F passes the canvas and
 *  default GL params in `props`.
 *
 *  When WebGPU is unavailable we set `forceWebGL` up front: otherwise init() tries
 *  the WebGPU backend, fails, and three logs `console.warn('WebGPURenderer: WebGPU
 *  is not available, running under WebGL2 backend.')` — which would trip DoD 1.7
 *  (the WebGL2 fallback should render without a misleading warning). `forceWebGL` takes
 *  the WebGL2 path directly, no warning.
 *
 *  No manual retry: init() itself already falls back to the WebGL2 backend when the
 *  WebGPU backend fails (three r184 Renderer.init → getFallback). The catch below is
 *  therefore only reached when WebGL2 ALSO failed — the genuinely unrenderable case. */
export async function createRenderer(props: RendererParams): Promise<THREE.WebGPURenderer> {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator
  try {
    const renderer = new THREE.WebGPURenderer({ antialias: true, ...props, forceWebGL: !hasWebGPU })
    await renderer.init()
    return renderer
  } catch (cause) {
    throw new RendererUnavailableError(cause)
  }
}

export function createRendererFactory(
  options: RendererOverrides & { onError?: (error: unknown) => void } = {},
): GLProps {
  const { onError, ...overrides } = options
  const factory = (props: RendererParams) =>
    createRenderer({ ...props, ...overrides }).catch((error: unknown) => {
      onError?.(error)
      throw error
    })
  // R3F's GLProps type does not expose the async WebGPURenderer factory signature.
  return factory as unknown as GLProps
}

export function asWebGPURenderer(renderer: unknown): THREE.WebGPURenderer {
  // R3F stores custom renderers as a generic GL object; this app always installs WebGPURenderer.
  return renderer as THREE.WebGPURenderer
}

export function useWebGPURenderer(): THREE.WebGPURenderer {
  return asWebGPURenderer(useThree((s) => s.gl))
}

/** Which backend WebGPURenderer actually selected — for a one-time console log.
 *  `isWebGPUBackend` is set on the concrete WebGPUBackend but not
 *  declared on the base Backend type, hence the narrow cast. */
export function rendererBackend(r: THREE.WebGPURenderer): 'webgpu' | 'webgl2' {
  const backend = r.backend as { isWebGPUBackend?: boolean } | undefined
  return backend?.isWebGPUBackend ? 'webgpu' : 'webgl2'
}
