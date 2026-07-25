import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three/webgpu'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

import { canAttachDomControls, observeElementResize } from './dom-controls.ts'
import {
  createArrivalLatchState,
  stepArrivalLatch,
  type NavigationPoseMode,
} from './navigation-latch.ts'

export type { NavigationPoseMode }

export interface NavigationPose {
  readonly mode: NavigationPoseMode
  /** World position of the travel target; null keeps the rig in free navigation. */
  readonly target: readonly [number, number, number] | null
  /** Identity of the travel target; a change re-arms the arrival latch even mid-mode. */
  readonly targetId: string | null
}

export interface NavigationRigProps {
  /** Polled once per frame (the getSnapshot pattern) — never React state (§3.2). */
  readonly getPose: () => NavigationPose
  /** Fired once per glide when the camera lands on the target framing. */
  readonly onArrived?: () => void
  readonly minDistance: number
  readonly maxDistance: number
  /** Camera-to-target distance a glide lands at. */
  readonly framingDistance: number
  /** Exp-damp responsiveness per glide mode (higher = snappier). */
  readonly glideLambda: { readonly focusing: number; readonly flying: number }
  /** Camera-to-goal distance below which a glide counts as arrived. */
  readonly arriveEpsilon: number
  /** A glide that can't settle within this many seconds force-arrives (safety net). */
  readonly arriveTimeoutSeconds: number
}

// Shared R3F layer: the product navigation rig. Free navigation (zoom · rotate · pan) is
// TrackballControls over the canvas DOM element — pan enabled, distance clamps from props — and
// stays inert on hosts without DOM events (native gesture input is a future input sibling).
// TrackballControls (not OrbitControls) so rotation NEVER blocks: it holds no fixed up-vector, so
// the universe tumbles past the poles and keeps spinning infinitely in any direction, where
// OrbitControls hard-clamps the polar angle to [0, π] and sticks at top/bottom.
// focus/fly glides are exp-damped camera moves toward the polled pose target; the control
// modes themselves live in the consumer's state machine, which this rig only reads.
// Damping needs update() every frame, so it runs in useFrame at default priority — before
// PostFX's priority-1 render.
export function NavigationRig({
  getPose,
  onArrived,
  minDistance,
  maxDistance,
  framingDistance,
  glideLambda,
  arriveEpsilon,
  arriveTimeoutSeconds,
}: NavigationRigProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsRef = useRef<TrackballControls | null>(null)
  const lookTarget = useMemo(() => new Vector3(), [])
  const targetVec = useMemo(() => new Vector3(), [])
  const approach = useMemo(() => new Vector3(), [])
  const cameraGoal = useMemo(() => new Vector3(), [])
  const latch = useRef(createArrivalLatchState())

  useEffect(() => {
    const el = gl.domElement
    if (!canAttachDomControls(el)) return
    const controls = new TrackballControls(camera, el)
    // Inertial damping (staticMoving off): the throw keeps gliding, never latching to a stop.
    controls.staticMoving = false
    controls.dynamicDampingFactor = 0.15
    controls.rotateSpeed = 1.4
    controls.zoomSpeed = 1.2
    controls.panSpeed = 0.6
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controls.target.copy(lookTarget)
    controlsRef.current = controls
    // The trackball maps pointer motion through the element's on-screen size, so a canvas resize
    // must be announced or the rotation math drifts.
    const unobserve = observeElementResize(el, () => controls.handleResize())
    return () => {
      controlsRef.current = null
      unobserve()
      controls.dispose()
    }
  }, [camera, gl, lookTarget, maxDistance, minDistance])

  useFrame((_, delta) => {
    const pose = getPose()
    const controls = controlsRef.current

    if (pose.mode === 'idle' || !pose.target) {
      stepArrivalLatch(latch.current, {
        mode: 'idle',
        targetId: pose.targetId,
        withinEpsilon: false,
        delta,
        arriveTimeoutSeconds,
      })
      if (controls) {
        controls.enabled = true
        controls.update()
        lookTarget.copy(controls.target)
      }
      return
    }

    if (controls) controls.enabled = false
    targetVec.set(pose.target[0], pose.target[1], pose.target[2])
    approach.copy(camera.position).sub(targetVec)
    if (approach.lengthSq() < 1e-6) approach.set(0, 0, 1)
    approach.normalize().multiplyScalar(framingDistance)
    cameraGoal.copy(targetVec).add(approach)

    const lambda = pose.mode === 'focusing' ? glideLambda.focusing : glideLambda.flying
    camera.position.x = MathUtils.damp(camera.position.x, cameraGoal.x, lambda, delta)
    camera.position.y = MathUtils.damp(camera.position.y, cameraGoal.y, lambda, delta)
    camera.position.z = MathUtils.damp(camera.position.z, cameraGoal.z, lambda, delta)
    lookTarget.x = MathUtils.damp(lookTarget.x, targetVec.x, lambda, delta)
    lookTarget.y = MathUtils.damp(lookTarget.y, targetVec.y, lambda, delta)
    lookTarget.z = MathUtils.damp(lookTarget.z, targetVec.z, lambda, delta)
    if (controls) controls.target.copy(lookTarget)
    camera.lookAt(lookTarget)

    // Arrival latch (pure reducer, unit-tested): fires ARRIVED once per glide when the camera
    // settles inside the epsilon shell, re-arms on drift out of it OR on a retarget (target id
    // change — even across an unobserved idle frame), and force-arrives past
    // arriveTimeoutSeconds so a glide can never strand the rig with controls disabled.
    const withinEpsilon =
      camera.position.distanceTo(cameraGoal) < arriveEpsilon &&
      lookTarget.distanceTo(targetVec) < arriveEpsilon
    if (
      stepArrivalLatch(latch.current, {
        mode: pose.mode,
        targetId: pose.targetId,
        withinEpsilon,
        delta,
        arriveTimeoutSeconds,
      })
    ) {
      onArrived?.()
    }
  })

  return null
}
