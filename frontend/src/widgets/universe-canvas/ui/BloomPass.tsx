// Node-based Bloom (Architecture §3.1). Import asymmetry is intentional: the
// pipeline CLASS lives in core (`three/webgpu`), the `bloom` helper is an addon.
//
// Use RenderPipeline, not the deprecated PostProcessing class (renamed in three r183+;
// its constructor emits a console warnOnce). Re-check this name on any three upgrade.
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

/** Owns the final output: composes scene → bloom and renders it. With useFrame
 *  priority > 0, R3F stops its automatic gl.render, so pipeline.render() becomes
 *  the frame's render — this replaces the official webgpu_postprocessing_bloom
 *  example's setAnimationLoop(animate) loop. The pipeline tracks the renderer's
 *  size automatically (no setSize). Works on WebGPU and the WebGL2 fallback (TSL
 *  compiles to both). */
export function BloomPass() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const { pipeline, nodes } = useMemo(() => {
    const scenePass = pass(scene, camera)
    // bloom(input, strength, radius, threshold) — low threshold so bright (HDR,
    // toneMapped=false) stars glow.
    const bloomNode = bloom(scenePass, 0.9, 0.5, 0.1)
    const p = new RenderPipeline(gl)
    p.outputNode = scenePass.add(bloomNode)
    return { pipeline: p, nodes: [scenePass, bloomNode] }
  }, [gl, scene, camera])

  useEffect(
    () => () => {
      // RenderPipeline.dispose() frees only its quad material, NOT the pass/bloom
      // node render targets — dispose those too so a route change / StrictMode
      // remount doesn't strand GPU textures (the renderer dispose in UniverseCanvas
      // is the final backstop).
      pipeline.dispose()
      for (const node of nodes) (node as { dispose?: () => void }).dispose?.()
    },
    [pipeline, nodes],
  )

  useFrame(() => {
    pipeline.render()
  }, 1)

  return null
}
