import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { positionLocal, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import {
  DEFAULT_BACKDROP_FIELD,
  backdropMoteCount,
  resolveBackdropField,
  type BackdropFieldKey,
} from '../assets/backdrop/backdrop-fields.ts'
import { backdropBrightness, backdropTint } from '../assets/backdrop/backdrop-life.ts'
import {
  DEFAULT_BACKDROP_MOTE,
  createBackdropMoteForm,
  resolveBackdropMote,
  type BackdropMoteKey,
} from '../assets/backdrop/backdrop-motes.ts'
import { scatterBackdrop } from '../assets/backdrop/backdrop-scatter.ts'
import { REDUCED_MOTION_FROZEN_TIME } from './reduced-motion.ts'

export interface StarFieldProps {
  /** Which particle: what it is drawn as, and what colour it is. */
  readonly mote?: BackdropMoteKey
  /** Which space: where the motes sit, how many, and how they twinkle. */
  readonly field?: BackdropFieldKey
  /** Number of background motes BEFORE the field's density; defaults to the web density. */
  readonly count?: number
  /** Outer shell radius — the field fills the volume out to here. Bound by the backdrop nesting
   *  invariant (camera zoom-out limit < this < sky sphere < far plane), not by taste. */
  readonly radius?: number
  /** Freeze the field's motion to a static frame. */
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

// Shared R3F layer: the decorative field behind everything — the universe backdrop every emotion sky
// wears. It carries no domain data at all, so what it looks like is free: a mote (form · colour) is
// poured into a field (place · density · twinkle) at a chosen size, and the whole thing is rebuilt
// from those three. Unlit on purpose — these read as light points, not as objects the scene lights.
//
// The shell reaches past the camera's zoom-out limit so the field still wraps the view from the
// farthest framing instead of shrinking into a clump at screen centre.
export function StarField({
  mote = DEFAULT_BACKDROP_MOTE,
  field = DEFAULT_BACKDROP_FIELD,
  count = STAR_FIELD_PROFILE.web.count,
  radius = STAR_FIELD_PROFILE.web.radius,
  reducedMotion = false,
}: StarFieldProps) {
  const ref = useRef<THREE.InstancedMesh | null>(null)
  // A fresh mesh starts at full count with zero matrices — every mote stacked at the origin, which
  // reads as an emptied field. Hide it until the matrix effect fills it, so a rebuild cannot paint
  // one frame of that clump. A stable callback ref, so an unrelated re-render can't reset the count.
  const attach = useCallback((mesh: THREE.InstancedMesh | null) => {
    ref.current = mesh
    if (mesh) {
      mesh.count = 0
      mesh.visible = false
    }
  }, [])
  const activeMote = resolveBackdropMote(mote)
  const activeField = resolveBackdropField(field)
  const moteCount = backdropMoteCount(activeField, count)
  const form = useMemo(() => createBackdropMoteForm(activeMote.form), [activeMote.form])
  const time = useMemo(() => uniform(0), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    // `positionLocal` carries the instance transform, so this IS the mote's world position; over the
    // shell radius it lands inside the unit ball, which is the space both graphs read place in.
    const inputs = { time, place: positionLocal.div(radius) }
    mat.colorNode = backdropTint(activeMote.tone, inputs).mul(
      backdropBrightness(activeField.life, inputs, {
        rate: activeField.twinkleRate,
        depth: activeField.twinkleDepth,
      }),
    )
    if (form.doubleSided) mat.side = THREE.DoubleSide
    if (form.additive) {
      // A hollow or flat mote only reads as LIGHT if the ones behind it show through, and at this
      // size sorting them would cost more than the field itself. Depth is still tested, so the
      // universe's own bodies stay in front of the backdrop.
      mat.transparent = true
      mat.blending = THREE.AdditiveBlending
      mat.depthWrite = false
    }
    return mat
  }, [
    activeField.life,
    activeField.twinkleDepth,
    activeField.twinkleRate,
    activeMote.tone,
    form,
    radius,
    time,
  ])

  const placed = useMemo(
    () => scatterBackdrop(activeField.scatter, { count: moteCount, radius }),
    [activeField.scatter, moteCount, radius],
  )

  // Write the instance matrices once per scatter. `form` and `material` are dependencies because
  // either one rebuilds the mesh through `args`, and the attach ref holds the rebuilt one at count 0
  // until this runs: without them, picking a mote that only changes the colour — or only the
  // geometry — would leave the field blank behind an unchanged scatter.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < moteCount; i++) {
      dummy.position.set(
        placed.positions[i * 3] ?? 0,
        placed.positions[i * 3 + 1] ?? 0,
        placed.positions[i * 3 + 2] ?? 0,
      )
      dummy.scale.setScalar(placed.scales[i] ?? 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = moteCount
    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = true
  }, [placed, moteCount, form, material])

  // One resource per effect: two motes can share a form and differ only in tone, and a material
  // rebuilt for that new tone must not dispose the geometry the next mesh is still drawn from.
  useEffect(() => () => form.geometry.dispose(), [form])
  useEffect(() => () => material.dispose(), [material])

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = REDUCED_MOTION_FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    if (ref.current) ref.current.rotation.y += delta * activeField.spin
    time.value += delta
  })

  // An emptied field is a row in the field catalogue, not an error state. Mounting a zero-instance
  // mesh for it would leave a draw call and a material behind for nothing.
  if (moteCount === 0) return null

  return (
    <instancedMesh ref={attach} args={[form.geometry, material, moteCount]} frustumCulled={false} />
  )
}
