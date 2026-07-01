import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { Scene } from 'three/webgpu'
import { nebulaBackgroundNode } from '../skin/background-node.ts'
import type { UniverseSkin } from '../skin/presets.ts'

// Shared R3F layer (web + native): drives the scene's TSL background node from the skin.
// Skin arrives as a prop — R3F runs its own reconciler, so context from the DOM/RN tree
// outside <Canvas> wouldn't reach in-canvas children; source the skin at the boundary.
export function Background({ skin }: { skin: UniverseSkin }) {
  const scene = useThree((state) => state.scene) as unknown as Scene
  useEffect(() => {
    scene.backgroundNode = nebulaBackgroundNode(skin)
    return () => {
      scene.backgroundNode = null
    }
  }, [scene, skin])
  return null
}
