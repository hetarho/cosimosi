import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

import { canAttachDomControls } from './dom-controls.ts'

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
    controls.maxDistance = 220
    controlsRef.current = controls

    // TrackballControls maps pointer motion through the element's on-screen size, so it must be told
    // when the canvas resizes (the responsive /test box) or the rotation math drifts. ResizeObserver
    // is reached via globalThis with a local structural type so this shared body still typechecks in
    // the native build (no DOM lib) that re-exports it; on web it binds the real DOM ResizeObserver,
    // on a host without one it stays inert.
    type ResizeObserverLike = { observe(target: typeof el): void; disconnect(): void }
    const ResizeObserverCtor = (
      globalThis as { ResizeObserver?: new (callback: () => void) => ResizeObserverLike }
    ).ResizeObserver
    let observer: ResizeObserverLike | null = null
    if (ResizeObserverCtor) {
      observer = new ResizeObserverCtor(() => controls.handleResize())
      observer.observe(el)
    }

    return () => {
      controlsRef.current = null
      observer?.disconnect()
      controls.dispose()
    }
  }, [camera, gl])

  useFrame(() => controlsRef.current?.update())
  return null
}
