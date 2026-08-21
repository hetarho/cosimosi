// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'

import { NavigationRig, type PinnedView } from './NavigationRig.tsx'

// The real controls attach pointer listeners and run their own math. What is under test is the rig's
// own half — the pinned envelope and the return — so both families are plain records here, and the
// camera is a real one so the geometry is real.
const orbits = vi.hoisted<Record<string, unknown>[]>(() => [])

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    enabled = true
    target = new Vector3()
    minDistance = 0
    maxDistance = 0
    enablePan = true
    enableDamping = false
    dampingFactor = 0
    rotateSpeed = 0
    minPolarAngle = 0
    maxPolarAngle = Math.PI
    update = vi.fn()
    dispose = vi.fn()
    constructor() {
      orbits.push(this as unknown as Record<string, unknown>)
    }
  },
}))

vi.mock('three/addons/controls/TrackballControls.js', () => ({
  TrackballControls: class {
    enabled = true
    target = new Vector3()
    minDistance = 0
    maxDistance = 0
    staticMoving = true
    dynamicDampingFactor = 0
    zoomSpeed = 0
    rotateSpeed = 0
    panSpeed = 0
    handleResize = vi.fn()
    update = vi.fn()
    dispose = vi.fn()
  },
}))

let camera = new PerspectiveCamera()
let frame: ((state: unknown, delta: number) => void) | null = null

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ camera, gl: { domElement: document.createElement('div') } }),
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame = callback
  },
}))

const TILT_UP = (20 * Math.PI) / 180
const TILT_DOWN = (10 * Math.PI) / 180
const OPENING_ELEVATION = (12 * Math.PI) / 180
const RIG = {
  minDistance: 8,
  maxDistance: 420,
  framingDistance: 40,
  glideLambda: { focusing: 4, flying: 2.2 },
  arriveEpsilon: 0.35,
  arriveTimeoutSeconds: 6,
  pinnedTiltUp: TILT_UP,
  pinnedTiltDown: TILT_DOWN,
  pinnedOpeningElevation: OPENING_ELEVATION,
  pinnedReturnLambda: 2.6,
  pinnedRotateSpeed: 0.7,
  pinnedDampingFactor: 0.12,
}

const IDLE = { mode: 'idle' as const, target: null, targetId: null }

function run(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) frame?.(null, 1 / 60)
}

/** Where the camera stands relative to a point, in the pinned view's own terms. */
function offsetFrom(center: readonly [number, number, number]) {
  const dx = camera.position.x - center[0]
  const dy = camera.position.y - center[1]
  const dz = camera.position.z - center[2]
  const flat = Math.hypot(dx, dy)
  return {
    azimuth: Math.atan2(dy, dx),
    elevation: Math.atan2(dz, flat),
    radius: Math.hypot(flat, dz),
  }
}

beforeEach(() => {
  orbits.length = 0
  frame = null
  camera = new PerspectiveCamera()
})

describe('NavigationRig — pinned', () => {
  it('wears the flat envelope: z is the orbit axis, no pan, tilt clamped both ways', () => {
    render(
      <NavigationRig
        getPose={() => IDLE}
        getPinnedView={() => ({ center: [0, 0, 0], held: false })}
        pinned
        {...RIG}
      />,
    )

    expect(camera.up.toArray()).toEqual([0, 0, 1])
    expect(orbits).toHaveLength(1)
    expect(orbits[0]).toMatchObject({
      enablePan: false,
      enableDamping: true,
      minDistance: 8,
      maxDistance: 420,
      minPolarAngle: Math.PI / 2 - TILT_UP,
      maxPolarAngle: Math.PI / 2 + TILT_DOWN,
    })
  })

  it('opens flat rather than swinging there, since the scene hands it a camera looking straight down', () => {
    // Straight overhead — 90° off the flat, the view the pinned mode exists to refuse.
    camera.position.set(0, 0, 150)
    render(
      <NavigationRig
        getPose={() => IDLE}
        getPinnedView={() => ({ center: [0, 0, 0], held: false })}
        pinned
        {...RIG}
      />,
    )

    frame?.(null, 1 / 60)

    const opened = offsetFrom([0, 0, 0])
    // Seated at its own opening rise, not merely legal: clamping the overhead camera would seat the
    // view against the top of the allowance with nothing left to rise into, and dead level would
    // hide the lens's depth. The seated rise leaves tilt to spend in both directions.
    expect(opened.elevation).toBeCloseTo(OPENING_ELEVATION, 6)
    // The distance the scene chose is kept; only the angle off the flat was out of bounds.
    expect(opened.radius).toBeCloseTo(150, 6)
    expect(orbits[0]?.enabled).toBe(true)
  })

  it('gives the tilt an allowance each way, more of it above the flat than below', () => {
    camera.position.set(150, 0, 0)
    render(
      <NavigationRig
        getPose={() => IDLE}
        getPinnedView={() => ({ center: [0, 0, 0], held: false })}
        pinned
        {...RIG}
      />,
    )
    run(1)

    // The clamp the controls hold opens further above the flat than below it — the rise is the view
    // the depth between the bands reads from.
    const orbit = orbits[0] as unknown as { minPolarAngle: number; maxPolarAngle: number }
    expect(Math.PI / 2 - orbit.minPolarAngle).toBeCloseTo(TILT_UP, 10)
    expect(orbit.maxPolarAngle - Math.PI / 2).toBeCloseTo(TILT_DOWN, 10)

    // And the rig's own envelope agrees with it — a camera dragged below the flat is kept where the
    // dip allows, not pushed back up to level.
    camera.position.set(150 * Math.cos(-TILT_DOWN), 0, 150 * Math.sin(-TILT_DOWN))
    run(2)

    expect(offsetFrom([0, 0, 0]).elevation).toBeCloseTo(-TILT_DOWN, 3)

    // Past the dip, the envelope pulls the camera back to the limit rather than letting it under.
    camera.position.set(150 * Math.cos(-TILT_UP), 0, 150 * Math.sin(-TILT_UP))
    run(3)

    expect(offsetFrom([0, 0, 0]).elevation).toBeGreaterThan(-TILT_UP)
  })

  it('eases into the flat when a viewer switches modes, rather than snapping the camera level', () => {
    camera.position.set(0, 0, 150)
    const props = {
      getPose: () => IDLE,
      getPinnedView: () => ({ center: [0, 0, 0] as [number, number, number], held: false }),
      ...RIG,
    }
    const { rerender } = render(<NavigationRig {...props} pinned={false} />)
    run(1)

    rerender(<NavigationRig {...props} pinned />)
    frame?.(null, 1 / 60)

    // One frame in it is on its way, not there: a snap would be the whole complaint the ease exists
    // to answer.
    expect(offsetFrom([0, 0, 0]).elevation).toBeGreaterThan(TILT_UP)

    run(4)

    const settled = offsetFrom([0, 0, 0])
    // Down to the tilt limit, give or take the angle the arrival shell spans at this distance: the
    // ease hands over once it is inside that shell, and the real OrbitControls holds the exact clamp
    // from there (this fake's update() does nothing, so the last fraction of a degree stays put).
    expect(settled.elevation).toBeLessThanOrEqual(TILT_UP + RIG.arriveEpsilon / settled.radius)
    expect(settled.radius).toBeCloseTo(150, 0)
    // Landed = the controls have the camera again.
    expect(orbits[0]?.enabled).toBe(true)
  })

  it('returns to the pose the viewer chose once the star that took the frame lets go', () => {
    camera.position.set(-120, 40, 10)
    const view: { current: PinnedView } = { current: { center: [0, 0, 0], held: false } }
    render(
      <NavigationRig getPose={() => IDLE} getPinnedView={() => view.current} pinned {...RIG} />,
    )
    run(4)
    const home = offsetFrom([0, 0, 0])

    // A star takes the frame — a click glides to it, and its panel holds the camera there.
    const star: [number, number, number] = [60, -80, 4]
    camera.position.set(star[0] + 30, star[1] + 12, star[2] + 20)
    view.current = { center: star, held: true }
    run(4)

    const held = offsetFrom(star)
    // Held, the camera orbits the STAR — flat, like everything else in this mode.
    expect(held.elevation).toBeLessThanOrEqual(TILT_UP + 1e-3)
    expect(camera.position.distanceTo(new Vector3(...star))).toBeLessThan(120)

    // The panel closes: the selection is cleared, and the middle of the stars is the centre again.
    view.current = { center: [0, 0, 0], held: false }
    run(6)

    const returned = offsetFrom([0, 0, 0])
    expect(returned.azimuth).toBeCloseTo(home.azimuth, 2)
    expect(returned.elevation).toBeCloseTo(home.elevation, 2)
    expect(returned.radius).toBeCloseTo(home.radius, 0)
  })

  it('holds the free tumble unchanged when the universe is not pinned', () => {
    camera.position.set(0, 0, 150)
    const before = camera.position.clone()
    render(
      <NavigationRig
        getPose={() => IDLE}
        getPinnedView={() => ({ center: [0, 0, 0], held: false })}
        pinned={false}
        {...RIG}
      />,
    )

    run(2)

    // No envelope, no return: the trackball owns the camera and this rig only calls update().
    expect(orbits).toHaveLength(0)
    expect(camera.position.distanceTo(before)).toBe(0)
  })
})
