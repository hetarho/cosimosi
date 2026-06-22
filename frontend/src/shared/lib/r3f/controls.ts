import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface OrbitControlsHandle {
  target: THREE.Vector3
  update: () => void
}

export function useOrbitControls(): OrbitControlsHandle | null {
  // drei writes OrbitControls into R3F's generic controls slot when makeDefault is set.
  return useThree((s) => s.controls) as OrbitControlsHandle | null
}
