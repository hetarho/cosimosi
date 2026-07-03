import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { canAttachDomControls } from './dom-controls.ts'

// Shared R3F layer: the demo orbit camera — drag to rotate, wheel/pinch to zoom, with
// inertial damping. A minimal inspection rig, not the product's navigation camera. Attaches
// to the canvas DOM element; on a host without one it stays inert rather than throwing.
// Damping needs update() every frame, so it runs in useFrame at default priority — before
// PostFX's priority-1 render.
export function CameraControls() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsRef = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const el = gl.domElement
    if (!canAttachDomControls(el)) return
    const controls = new OrbitControls(camera, el)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 20
    controls.maxDistance = 220
    controlsRef.current = controls
    return () => {
      controlsRef.current = null
      controls.dispose()
    }
  }, [camera, gl])

  useFrame(() => controlsRef.current?.update())
  return null
}
