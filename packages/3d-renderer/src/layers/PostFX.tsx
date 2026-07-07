import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu'
import { pass, vec4 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

/** Scene-level bloom tuning — ambiance shared by every background type, carried on the skin. */
export interface BloomParams {
  readonly strength: number
  readonly radius: number
  readonly threshold: number
}

// Shared R3F layer: a TSL bloom pass over the scene, per the skin's bloom params. Runs on
// the WebGPU path and degrades on WebGL2. Takes the render loop with a positive-priority
// useFrame (R3F's default render yields to it). The canvas host initializes the renderer
// up-front, so the pipeline drives the synchronous render() each frame.
export function PostFX({ bloom: params, transparent = false }: { bloom: BloomParams; transparent?: boolean }) {
  const renderer = useThree((state) => state.gl) as unknown as WebGPURenderer
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const pipeline = useMemo(() => {
    const composer = new RenderPipeline(renderer)
    const scenePass = pass(scene, camera)
    const bloomPass = bloom(scenePass, params.strength, params.radius, params.threshold)
    // Opaque host (default): add bloom over the scene as-is (alpha comes out saturated → the
    // canvas is opaque). Transparent host: the scene pass is cleared to zero alpha (the canvas
    // sets `setClearColor(…, 0)`), so keep that coverage as the OUTPUT alpha and add bloom only
    // in RGB. On a premultiplied canvas this lets empty space stay see-through (the DOM backdrop
    // shows through) while the star pixels stay opaque and the bloom halo adds light additively
    // over the backdrop — instead of a post-processed opaque black plate covering everything.
    composer.outputNode = transparent
      ? vec4(scenePass.rgb.add(bloomPass.rgb), scenePass.a)
      : scenePass.add(bloomPass)
    return composer
  }, [renderer, scene, camera, params, transparent])

  useEffect(() => () => pipeline.dispose(), [pipeline])
  useFrame(() => pipeline.render(), 1)

  return null
}
