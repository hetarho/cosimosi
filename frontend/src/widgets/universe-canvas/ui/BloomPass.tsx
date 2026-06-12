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
  // The pass node's render targets are sized when the pipeline is BUILT and do not
  // follow later renderer-size changes. If that size ever differs from the canvas
  // swapchain — the canvas mounts after first paint (login splash→canvas, SPA route
  // change) so R3F sizes the renderer a tick later, or the window is resized — every
  // frame's color attachment (300×150 / stale) mismatches the swapchain resolve target
  // and the command buffer is rejected (black screen). Rebuild the pipeline whenever
  // the logical size or DPR changes so the pass targets always match the renderer.
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)

  const { pipeline, nodes } = useMemo(() => {
    const scenePass = pass(scene, camera)
    // bloom(input, strength, radius, threshold) — low threshold so bright (HDR,
    // toneMapped=false) stars glow.
    const bloomNode = bloom(scenePass, 0.9, 0.5, 0.1)
    const p = new RenderPipeline(gl)
    p.outputNode = scenePass.add(bloomNode)
    return { pipeline: p, nodes: [scenePass, bloomNode] }
    // width/height/dpr are deliberate REBUILD KEYS, not values used in the body: a
    // deferred mount or a resize must rebuild the pass targets at the new size (see
    // comment above). exhaustive-deps flags them as "unnecessary" for exactly that
    // reason — the rebuild-on-size-change is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, width, height, dpr])

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
