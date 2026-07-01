import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { Scene } from 'three/webgpu'

// Shared R3F layer (web + native): assigns a ready background node to the scene. The node is
// resolved from the skin's background spec by the assets layer (registry) and passed in — so
// this layer names no concrete background type. The node arrives as a prop: R3F runs its own
// reconciler, so context from the DOM/RN tree outside <Canvas> wouldn't reach in-canvas
// children; source it at the boundary.
export function Background({ node }: { node: NonNullable<Scene['backgroundNode']> }) {
  const scene = useThree((state) => state.scene) as unknown as Scene
  useEffect(() => {
    scene.backgroundNode = node
    return () => {
      scene.backgroundNode = null
    }
  }, [scene, node])
  return null
}
