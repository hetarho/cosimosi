import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

import { canAttachDomControls, observeElementResize } from './dom-controls.ts'

// Shared R3F layer: the demo inspection camera — drag to rotate, wheel/pinch to zoom, with
// inertial damping. TrackballControls (not OrbitControls) so rotation NEVER blocks: it holds no
// fixed up-vector, so you can tumble past the poles and keep spinning infinitely in any direction
// (OrbitControls hard-clamps the polar angle to [0, π] and sticks at top/bottom). A minimal rig,
// not the product's navigation camera. Attaches to the canvas DOM element; on a host without one it
// stays inert rather than throwing. Damping needs update() every frame, so it runs in useFrame at
// default priority — before PostFX's priority-1 render.
export function CameraControls() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsRef = useRef<TrackballControls | null>(null)

  useEffect(() => {
    const el = gl.domElement
    if (!canAttachDomControls(el)) return
    const controls = new TrackballControls(camera, el)
    controls.noPan = true
    // Inertial damping (staticMoving off): the throw keeps gliding, never latching to a stop.
    controls.staticMoving = false
    controls.dynamicDampingFactor = 0.15
    controls.rotateSpeed = 1.8
    controls.zoomSpeed = 1.2
    controls.minDistance = 20
    controls.maxDistance = 420
    controlsRef.current = controls

    // Keep the trackball's pointer→rotation mapping honest across canvas resizes (the responsive
    // /test box).
    const unobserve = observeElementResize(el, () => controls.handleResize())

    return () => {
      controlsRef.current = null
      unobserve()
      controls.dispose()
    }
  }, [camera, gl])

  useFrame(() => controlsRef.current?.update())
  return null
}
