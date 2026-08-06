import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

import { canAttachDomControls, observeElementResize } from './dom-controls.ts'
import { applyTrackballFeel } from './trackball-feel.ts'

export interface CameraControlsProps {
  /** Zoom-in limit. Required rather than defaulted: the universe owns one envelope for every camera
   *  (`UNIVERSE_CAMERA_ENVELOPE`), and a default here would be a second copy of it free to drift. */
  readonly minDistance: number
  /** Zoom-out limit. Must stay inside the backdrop nesting (see `backdrop-scale.ts`). */
  readonly maxDistance: number
}

// Shared R3F layer: the demo inspection camera — drag to rotate, wheel/pinch to zoom, with
// inertial damping. TrackballControls (not OrbitControls) so rotation NEVER blocks: it holds no
// fixed up-vector, so you can tumble past the poles and keep spinning infinitely in any direction
// (OrbitControls hard-clamps the polar angle to [0, π] and sticks at top/bottom). A minimal rig,
// not the product's navigation camera. Attaches to the canvas DOM element; on a host without one it
// stays inert rather than throwing. Damping needs update() every frame, so it runs in useFrame at
// default priority — before PostFX's priority-1 render.
export function CameraControls({ minDistance, maxDistance }: CameraControlsProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsRef = useRef<TrackballControls | null>(null)

  useEffect(() => {
    const el = gl.domElement
    if (!canAttachDomControls(el)) return
    const controls = new TrackballControls(camera, el)
    controls.noPan = true
    applyTrackballFeel(controls)
    // Faster than the product rig's 1.4: inspection wants a quick tumble around one body, where the
    // universe wants a settled drift across a whole scene.
    controls.rotateSpeed = 1.8
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controlsRef.current = controls

    // Keep the trackball's pointer→rotation mapping honest across canvas resizes (the responsive
    // /test box).
    const unobserve = observeElementResize(el, () => controls.handleResize())

    return () => {
      controlsRef.current = null
      unobserve()
      controls.dispose()
    }
  }, [camera, gl, maxDistance, minDistance])

  useFrame(() => controlsRef.current?.update())
  return null
}
