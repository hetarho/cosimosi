import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PostProcessing, type WebGPURenderer } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import type { UniverseSkin } from '../skin/presets.ts'

// Shared R3F layer: a TSL bloom pass over the scene, per the skin's bloom params. Runs on
// the WebGPU path and degrades on WebGL2. Takes the render loop with a positive-priority
// useFrame (R3F's default render yields to it). renderAsync() per frame is the documented
// three WebGPU post-processing pattern (the renderer queues).
export function PostFX({ skin }: { skin: UniverseSkin }) {
  const renderer = useThree((state) => state.gl) as unknown as WebGPURenderer
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const post = useMemo(() => {
    const composer = new PostProcessing(renderer)
    const scenePass = pass(scene, camera)
    const bloomPass = bloom(scenePass, skin.bloom.strength, skin.bloom.radius, skin.bloom.threshold)
    composer.outputNode = scenePass.add(bloomPass)
    return composer
  }, [renderer, scene, camera, skin])

  useEffect(() => () => post.dispose(), [post])
  useFrame(() => void post.renderAsync(), 1)

  return null
}
