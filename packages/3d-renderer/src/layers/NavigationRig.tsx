import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Matrix4, Quaternion, Vector3, type Camera } from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

import { canAttachDomControls, observeElementResize } from './dom-controls.ts'
import { applyTrackballFeel } from './trackball-feel.ts'
import {
  createPinnedOffset,
  pinnedCameraPosition,
  readPinnedOffset,
  type PinnedEnvelope,
  type PinnedOffset,
} from './pinned-pose.ts'
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

export interface PinnedView {
  /** World point the pinned camera orbits — a held star, or the middle of the stars. */
  readonly center: readonly [number, number, number]
  /**
   * True while something is holding the camera at that point — a selected star, a spotlight. The
   * pose the viewer last chose is REMEMBERED rather than rewritten while this holds, so letting go
   * returns the camera to where they were looking from, not to wherever a glide left it.
   */
  readonly held: boolean
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
  /**
   * Whether the universe is held flat. It changes only when a viewer says so, which is why it is a
   * prop and not a polled value: the two navigation modes wear different controls, and the swap
   * belongs to the effect that owns them.
   */
  readonly pinned: boolean
  /** Polled once per frame while pinned — what the flat camera is orbiting right now. */
  readonly getPinnedView: () => PinnedView
  /** Largest angle off the flat the pinned camera may tilt, in radians. */
  readonly pinnedTilt: number
  /** Exp-damp responsiveness of the return to the pinned pose. */
  readonly pinnedReturnLambda: number
  readonly pinnedRotateSpeed: number
  readonly pinnedDampingFactor: number
}

/** What the frame loop needs from either control family; only the trackball is told about resizes. */
interface RigControls {
  enabled: boolean
  readonly target: Vector3
  update(): unknown
  dispose(): void
}

/** The universe's own up: the z axis the two memory bands are stacked along ([V9]). */
const WORLD_UP = new Vector3(0, 0, 1)
/** Orientation error below which the return glide counts as landed, in radians (~0.6°). */
const SETTLED_ANGLE = 0.01

// Shared R3F layer: the product navigation rig, in either of the two shapes a viewer can hold the
// universe in.
//
// FREE navigation (zoom · rotate · pan) is TrackballControls over the canvas DOM element, which
// holds no fixed up-vector: the universe tumbles past the poles and keeps spinning infinitely in any
// direction, where OrbitControls would hard-clamp the polar angle and stick at top/bottom.
//
// PINNED navigation is that same clamp, wanted on purpose. The universe's own up is +z — memories
// lie in the hippocampus band with their gists floating in the neocortex band above ([V9]) — so the
// pinned camera makes z the orbit axis, bounds the tilt off the flat, refuses to pan, and holds the
// middle of the stars in the middle of the frame. What is left is azimuth and zoom: you walk around
// the universe and step toward it, and it never rolls out from under you.
//
// Both control families stay inert on hosts without DOM events (native gesture input is a future
// input sibling) — the pinned framing itself does not, because it is camera math rather than input.
// focus/fly glides are exp-damped camera moves toward the polled pose target; the control modes
// themselves live in the consumer's state machine, which this rig only reads. Damping needs update()
// every frame, so it runs in useFrame at default priority — before PostFX's priority-1 render.
export function NavigationRig({
  getPose,
  onArrived,
  minDistance,
  maxDistance,
  framingDistance,
  glideLambda,
  arriveEpsilon,
  arriveTimeoutSeconds,
  pinned,
  getPinnedView,
  pinnedTilt,
  pinnedReturnLambda,
  pinnedRotateSpeed,
  pinnedDampingFactor,
}: NavigationRigProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsRef = useRef<RigControls | null>(null)
  const lookTarget = useMemo(() => new Vector3(), [])
  const targetVec = useMemo(() => new Vector3(), [])
  const approach = useMemo(() => new Vector3(), [])
  const cameraGoal = useMemo(() => new Vector3(), [])
  const latch = useRef(createArrivalLatchState())

  // Pinned-view scratch, allocated once (§3.3). `live` is this frame's reading of where the camera
  // stands; the memory below is everything the pinned view carries between frames.
  const pinnedCenter = useMemo(() => new Vector3(), [])
  const liveOffset = useMemo(() => createPinnedOffset(), [])
  const goalRotation = useMemo(() => new Matrix4(), [])
  const goalQuaternion = useMemo(() => new Quaternion(), [])
  const pinnedMemory = useRef<PinnedMemory>({
    home: createPinnedOffset(),
    hasHome: false,
    settled: false,
    held: false,
    firstFrame: true,
  })
  const envelope = useMemo<PinnedEnvelope>(
    () => ({ maxTilt: pinnedTilt, minDistance, maxDistance }),
    [pinnedTilt, minDistance, maxDistance],
  )

  useEffect(() => {
    const el = gl.domElement
    if (!canAttachDomControls(el)) return
    // The pinned camera has to adopt the flat's up BEFORE its controls exist: OrbitControls reads
    // `object.up` once, as the axis it orbits around. Setting it is invisible on its own — nothing
    // renders from `up` — so the picture only moves when the frame loop eases the camera in.
    if (pinned) camera.up.copy(WORLD_UP)
    // Both families run one update() from inside their constructor, while their target is still the
    // origin — which re-aims the camera at the middle of the world the instant a mode is swapped.
    // The pose is put back below, so swapping controls moves nothing and every camera move stays the
    // frame loop's.
    const heldPosition = camera.position.clone()
    const heldQuaternion = camera.quaternion.clone()
    const controls = pinned ? new OrbitControls(camera, el) : new TrackballControls(camera, el)
    if (controls instanceof OrbitControls) {
      controls.enablePan = false
      controls.enableDamping = true
      controls.dampingFactor = pinnedDampingFactor
      controls.rotateSpeed = pinnedRotateSpeed
      controls.minPolarAngle = Math.PI / 2 - pinnedTilt
      controls.maxPolarAngle = Math.PI / 2 + pinnedTilt
      // The rig hands over only once the camera sits inside the envelope; until then its own return
      // glide owns the camera, so the clamp lands as an ease rather than as a snap.
      controls.enabled = false
    } else {
      applyTrackballFeel(controls)
      // Slower than the inspection controls' 1.8, and pan enabled: navigating a whole universe wants
      // a settled drift, not a quick tumble around one body.
      controls.rotateSpeed = 1.4
      controls.panSpeed = 0.6
    }
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controls.target.copy(lookTarget)
    camera.position.copy(heldPosition)
    camera.quaternion.copy(heldQuaternion)
    controlsRef.current = controls
    // A mode swap starts from the view it inherits rather than from a pose chosen in a previous one.
    pinnedMemory.current.hasHome = false
    pinnedMemory.current.settled = false
    // The trackball maps pointer motion through the element's on-screen size, so a canvas resize
    // must be announced or the rotation math drifts. OrbitControls measures the element itself and
    // has nothing to be told.
    const unobserve = observeElementResize(el, () => {
      if (controls instanceof TrackballControls) controls.handleResize()
    })
    return () => {
      controlsRef.current = null
      unobserve()
      controls.dispose()
    }
  }, [
    camera,
    gl,
    lookTarget,
    maxDistance,
    minDistance,
    pinned,
    pinnedDampingFactor,
    pinnedRotateSpeed,
    pinnedTilt,
  ])

  useFrame((_, delta) => {
    const pose = getPose()
    const controls = controlsRef.current
    // Spent here rather than inside the pinned step, so a rig that opened free has already used its
    // opening frame by the time a viewer swaps into pinned and expects to watch the camera move.
    const opening = pinnedMemory.current.firstFrame
    pinnedMemory.current.firstFrame = false

    if (pose.mode === 'idle' || !pose.target) {
      stepArrivalLatch(latch.current, {
        mode: 'idle',
        targetId: pose.targetId,
        withinEpsilon: false,
        delta,
        arriveTimeoutSeconds,
      })
      if (pinned) {
        stepPinnedView({
          controls,
          camera,
          delta,
          view: getPinnedView(),
          envelope,
          lookTarget,
          pinnedCenter,
          cameraGoal,
          memory: pinnedMemory.current,
          instant: opening,
          liveOffset,
          goalRotation,
          goalQuaternion,
          returnLambda: pinnedReturnLambda,
          arriveEpsilon,
        })
        return
      }
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

/** What the pinned view remembers between frames. Mutated in place — this runs every frame. */
interface PinnedMemory {
  /** The pose the viewer chose for themselves, to come back to once nothing holds the frame. */
  readonly home: PinnedOffset
  /** False until the first pinned frame reads a pose, so turning the mode on adopts the view. */
  hasHome: boolean
  /** Whether last frame ended inside the envelope, with the camera in the controls' hands. */
  settled: boolean
  /** Whether last frame was held — the frame a hold is released on must not overwrite `home`. */
  held: boolean
  /**
   * True until this rig has drawn its first frame at all. The scene hands the camera in looking
   * straight down, which is the one view the pinned mode exists to refuse, so a universe that OPENS
   * pinned takes the flat pose outright rather than gliding into it — easing there would spend the
   * arrival on a swing nobody asked for. It is spent on the first frame in either mode, so a later
   * swap into pinned is a change the viewer made and gets to watch happen.
   */
  firstFrame: boolean
}

interface PinnedStep {
  readonly controls: RigControls | null
  readonly camera: Camera
  readonly delta: number
  readonly view: PinnedView
  readonly envelope: PinnedEnvelope
  readonly lookTarget: Vector3
  readonly pinnedCenter: Vector3
  readonly cameraGoal: Vector3
  readonly memory: PinnedMemory
  /** This rig's opening frame — take the pose outright instead of easing into it. */
  readonly instant: boolean
  readonly liveOffset: PinnedOffset
  readonly goalRotation: Matrix4
  readonly goalQuaternion: Quaternion
  readonly returnLambda: number
  readonly arriveEpsilon: number
}

/**
 * One frame of the pinned view.
 *
 * The camera orbits a centre that eases toward whatever the scene says it should hold — the middle
 * of the stars, or a star that has taken the frame. Where the camera stands relative to that centre
 * is one bounded offset (azimuth · tilt off the flat · distance), and the rig only ever does two
 * things with it:
 *
 * - **already there** — hand the camera to the orbit controls, which are what keep it inside the
 *   envelope, and keep reading the pose back out as the one to return to.
 * - **not there yet** — a glide has just let go, a hold has just been released, or the mode was only
 *   now turned on — ease position and slerp orientation toward the goal, with the controls off so
 *   nothing snaps.
 *
 * The reading-back is what makes a release a RETURN: while something holds the frame it stops, so
 * the pose that letting go comes back to is the one the viewer last chose rather than the one a
 * glide left them in. It resumes only a frame after the hold ends, once the return has landed.
 */
function stepPinnedView({
  controls,
  camera,
  delta,
  view,
  envelope,
  lookTarget,
  pinnedCenter,
  cameraGoal,
  memory,
  instant,
  liveOffset,
  goalRotation,
  goalQuaternion,
  returnLambda,
  arriveEpsilon,
}: PinnedStep): void {
  pinnedCenter.set(view.center[0], view.center[1], view.center[2])
  if (instant) {
    lookTarget.copy(pinnedCenter)
  } else {
    lookTarget.x = MathUtils.damp(lookTarget.x, pinnedCenter.x, returnLambda, delta)
    lookTarget.y = MathUtils.damp(lookTarget.y, pinnedCenter.y, returnLambda, delta)
    lookTarget.z = MathUtils.damp(lookTarget.z, pinnedCenter.z, returnLambda, delta)
  }

  readPinnedOffset(liveOffset, camera.position, lookTarget, envelope)
  // Reading the live pose BEFORE the goal is computed from it is what lets a drag run: the goal a
  // settled free camera is measured against is where it already is, so moving fast under the
  // viewer's own hand never reads as having left.
  if (!memory.hasHome || (!view.held && !memory.held && memory.settled)) {
    memory.home.azimuth = liveOffset.azimuth
    memory.home.elevation = liveOffset.elevation
    memory.home.radius = liveOffset.radius
    memory.hasHome = true
  }
  // Opening dead level rather than at whatever the incoming camera clamps to. The scene hands this
  // rig a camera looking straight down, so the clamp alone would seat the view against the TOP of
  // the allowance and leave the give all on one side; from the flat, the tilt has both of its halves.
  if (instant) memory.home.elevation = 0
  // A held frame is orbited from wherever the viewer already is; a released one returns to the pose
  // they left. Both offsets were clamped on the way in, so either goal is inside the envelope.
  const goalOffset = view.held ? liveOffset : memory.home
  pinnedCameraPosition(cameraGoal, lookTarget, goalOffset)
  goalRotation.lookAt(cameraGoal, lookTarget, WORLD_UP)
  goalQuaternion.setFromRotationMatrix(goalRotation)

  if (instant) {
    camera.position.copy(cameraGoal)
    camera.quaternion.copy(goalQuaternion)
  }

  const settled =
    camera.position.distanceTo(cameraGoal) < arriveEpsilon &&
    camera.quaternion.angleTo(goalQuaternion) < SETTLED_ANGLE
  memory.settled = settled
  memory.held = view.held

  if (settled) {
    if (controls) {
      controls.enabled = true
      controls.target.copy(lookTarget)
      controls.update()
      lookTarget.copy(controls.target)
    }
    return
  }

  if (controls) controls.enabled = false
  camera.position.x = MathUtils.damp(camera.position.x, cameraGoal.x, returnLambda, delta)
  camera.position.y = MathUtils.damp(camera.position.y, cameraGoal.y, returnLambda, delta)
  camera.position.z = MathUtils.damp(camera.position.z, cameraGoal.z, returnLambda, delta)
  // Slerped rather than re-aimed with lookAt: coming out of a free tumble the camera can be rolled
  // right over, and easing the whole orientation rights the horizon on the way in instead of
  // snapping it level on the first frame.
  camera.quaternion.slerp(goalQuaternion, 1 - Math.exp(-returnLambda * delta))
}
