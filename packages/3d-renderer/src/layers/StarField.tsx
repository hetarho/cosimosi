import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, fract, instanceIndex, pow, sin, uniform, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

export interface StarFieldProps {
  /** Number of background stars; defaults to the web density. */
  readonly count?: number
  /** Outer shell radius — the field fills the volume out to here. Bound by the backdrop nesting
   *  invariant (camera zoom-out limit < this < sky sphere < far plane), not by taste. */
  readonly radius?: number
  readonly color?: THREE.ColorRepresentation
  /** Slow drift, radians/sec. */
  readonly spin?: number
  /** Freeze the twinkle to a static frame. */
  readonly reducedMotion?: boolean
}

/**
 * The two platform backdrop densities, straight from `rendering.star_field_*`. A scene takes one of
 * these whole rather than a loose count, so a surface can never end up wearing the web's instance
 * count with the mobile radius (the two are read together by the nesting invariant).
 */
export const STAR_FIELD_PROFILE = {
  web: { count: VALUES.rendering.starFieldCount, radius: VALUES.rendering.starFieldRadius },
  mobile: {
    count: VALUES.rendering.starFieldCountMobile,
    radius: VALUES.rendering.starFieldRadiusMobile,
  },
} as const satisfies Record<string, { readonly count: number; readonly radius: number }>

export type StarFieldProfile = (typeof STAR_FIELD_PROFILE)[keyof typeof STAR_FIELD_PROFILE]

const FROZEN_TIME = 8

/** Innermost shell the scatter starts at, as a fraction of `radius` — keeps the origin clear. */
const INNER_FRACTION = 0.28
/** Distance whose stars render at the geometry's own size; nearer/farther scale from here. */
const SIZE_REFERENCE = 60
/** Fixed scatter seed: the field is random-looking yet identical on every mount and platform. */
const SCATTER_SEED = 20260725
/** World radius of one mote before the per-star distance scaling. */
const MOTE_RADIUS = 0.18

// Park-Miller minimal-standard LCG — a tiny deterministic PRNG using only integer * and % (all
// operands stay < 2^53, so it is exact and identical across JS engines → web and mobile agree).
// The precedent is the latent field's generator; kept self-contained here because this backdrop is
// decorative and carries no domain data.
const PM_MODULUS = 2147483647 // 2^31 - 1
const PM_MULTIPLIER = 16807

function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) % PM_MODULUS
  if (state <= 0) state += PM_MODULUS - 1
  return () => {
    state = (state * PM_MULTIPLIER) % PM_MODULUS
    return (state - 1) / (PM_MODULUS - 1)
  }
}

// Per-star hash in the shader: a scattered 0..1 off the instance id, one independent draw per salt.
// The twinkle can't take its numbers from the CPU scatter (the material never sees an instance), and
// a smooth walk over the id — a golden-ratio phase — makes the field pulse as one travelling wave.
// This decorrelates phase, rate, and shape per star, so each one sparkles on its own clock.
function starHash(salt: number) {
  return fract(sin(float(instanceIndex).mul(12.9898).add(salt)).mul(43758.5453))
}

// Package-internal construction seam: an icosahedron, not a UV sphere. A mote covers a handful of
// pixels, so tessellation buys nothing but the silhouette, and a UV sphere of the same triangle
// count spends most of them crowding the poles — where a 1-px dot has none to spare. At
// `star_field_mote_detail: 0` the twenty faces still give a rounder outline than the 8x8 UV sphere
// this replaces, for 20 triangles instead of 112.
export function createStarFieldGeometry() {
  return new THREE.IcosahedronGeometry(MOTE_RADIUS, VALUES.rendering.starFieldMoteDetail)
}

// Shared R3F layer: the small floating background stars — the universe backdrop every emotion sky
// wears. Unlit (MeshBasicNodeMaterial) so they read as light points, and each star TWINKLES on its
// own phase (a per-instance hash off `instanceIndex` drives a host-timed sine), so the field shimmers
// like real starlight rather than sitting as dead dots. Deterministic scatter — no domain data.
// The shell reaches past the camera's zoom-out limit so the field still wraps the view from the
// farthest framing instead of shrinking into a clump at screen centre.
export function StarField({
  count = STAR_FIELD_PROFILE.web.count,
  radius = STAR_FIELD_PROFILE.web.radius,
  color = '#cfe0ff',
  spin = 0.01,
  reducedMotion = false,
}: StarFieldProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => createStarFieldGeometry(), [])
  const time = useMemo(() => uniform(0), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    const c = new THREE.Color(color)
    // Every star gets its own phase, its own rate (0.5..2.6 rad/s — no shared beat), its own pulse
    // shape (the exponent sharpens the sine from a slow breath into a brief spark), and its own
    // steady glow, so nothing sweeps through the field in order. The floor keeps each star faintly
    // lit between sparkles rather than blinking out, and `dim` leaves the field a mix of faint and
    // bright rather than one uniform brightness.
    // Ranges are kept moderate on purpose: a steep exponent or a deep dim factor spends most of
    // each cycle near the floor, and the field reads as dead dots instead of a shimmering sky.
    const phase = starHash(11.7).mul(6.2831853)
    const rate = starHash(31.3).mul(2.1).add(0.5)
    const sharpness = starHash(57.1).mul(2.5).add(1)
    const floorGlow = starHash(79.9).mul(0.28).add(0.22)
    const dim = starHash(97.3).mul(0.45).add(0.55)
    const pulse = sin(time.mul(rate).add(phase)).mul(0.5).add(0.5)
    const brightness = pow(pulse, sharpness).mul(float(1).sub(floorGlow)).add(floorGlow).mul(dim)
    mat.colorNode = vec3(c.r, c.g, c.b).mul(brightness)
    return mat
  }, [color, time])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const random = seededRandom(SCATTER_SEED)
    const innerCubed = INNER_FRACTION ** 3
    for (let i = 0; i < count; i++) {
      // Independent random draws per star, NOT a Fibonacci lattice: an even index-driven spread
      // leaves a spiral you can trace across the sky. Real starlight clumps and leaves voids, and
      // that irregularity is the whole reason this reads as a sky rather than a pattern.
      // `z = 1 - 2u` keeps the direction uniform over the sphere (no pole crowding), and the cube
      // root makes the radius volume-uniform so the field doesn't pack onto its inner shells.
      const cosPhi = 1 - 2 * random()
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
      const theta = random() * Math.PI * 2
      const r = radius * Math.cbrt(innerCubed + random() * (1 - innerCubed))
      dummy.position.set(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * cosPhi)
      // Size rides its own distance, so every shell keeps about the same on-screen size — the far
      // ones stay visible sparks instead of falling below a pixel. The squared draw skews the field
      // toward faint pinpricks with a few bright standouts, the way a real sky is graded.
      const jitter = 0.45 + 1.15 * random() ** 1.6
      dummy.scale.setScalar((jitter * r) / SIZE_REFERENCE)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, radius])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    if (ref.current) ref.current.rotation.y += delta * spin
    time.value += delta
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
}
