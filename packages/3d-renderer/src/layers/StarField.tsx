import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { positionLocal, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import {
  DEFAULT_BACKDROP_THEME,
  backdropMoteCount,
  resolveBackdropTheme,
  type BackdropThemeKey,
} from '../assets/backdrop/backdrop-themes.ts'
import { backdropBrightness, backdropTint } from '../assets/backdrop/backdrop-life.ts'
import { createBackdropMote } from '../assets/backdrop/backdrop-motes.ts'
import { scatterBackdrop } from '../assets/backdrop/backdrop-scatter.ts'
import { REDUCED_MOTION_FROZEN_TIME } from './reduced-motion.ts'

export interface StarFieldProps {
  /** Which backdrop the field wears — the whole character of it, not one particle's look. */
  readonly theme?: BackdropThemeKey
  /** Number of background motes BEFORE the theme's density; defaults to the web density. */
  readonly count?: number
  /** Outer shell radius — the field fills the volume out to here. Bound by the backdrop nesting
   *  invariant (camera zoom-out limit < this < sky sphere < far plane), not by taste. */
  readonly radius?: number
  /** Bench magnification over the theme's own mote size. A field is tuned to be seen from inside a
   *  universe, where one mote is a few pixels; a review surface reads it at arm's length and needs to
   *  enlarge the motes to judge a FORM by. Production leaves this at 1. */
  readonly sizeScale?: number
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
// wears. It carries no domain data at all, so what it looks like is free: a theme arranges the four
// backdrop axes (where the motes sit, what one is drawn as, how its brightness moves, what colour
// that is spent on) and the field is rebuilt from them. Unlit on purpose — these read as light
// points, not as objects the scene lights.
//
// The shell reaches past the camera's zoom-out limit so the field still wraps the view from the
// farthest framing instead of shrinking into a clump at screen centre.
export function StarField({
  theme = DEFAULT_BACKDROP_THEME,
  count = STAR_FIELD_PROFILE.web.count,
  radius = STAR_FIELD_PROFILE.web.radius,
  sizeScale = 1,
  reducedMotion = false,
}: StarFieldProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const active = resolveBackdropTheme(theme)
  const moteCount = backdropMoteCount(active, count)
  const mote = useMemo(() => createBackdropMote(active.mote), [active.mote])
  const time = useMemo(() => uniform(0), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    // `positionLocal` carries the instance transform, so this IS the mote's world position; over the
    // shell radius it lands inside the unit ball, which is the space both axes read place in.
    const inputs = { time, place: positionLocal.div(radius) }
    mat.colorNode = backdropTint(active.tone, inputs).mul(backdropBrightness(active.life, inputs))
    if (mote.doubleSided) mat.side = THREE.DoubleSide
    if (mote.additive) {
      // A hollow or flat mote only reads as LIGHT if the ones behind it show through, and at this
      // size sorting them would cost more than the field itself. Depth is still tested, so the
      // universe's own bodies stay in front of the backdrop.
      mat.transparent = true
      mat.blending = THREE.AdditiveBlending
      mat.depthWrite = false
    }
    return mat
  }, [active.life, active.tone, mote, radius, time])

  const field = useMemo(
    () =>
      scatterBackdrop(active.scatter, {
        count: moteCount,
        radius,
        sizeScale: active.size * sizeScale,
      }),
    [active.scatter, active.size, moteCount, radius, sizeScale],
  )

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < moteCount; i++) {
      dummy.position.set(
        field.positions[i * 3] ?? 0,
        field.positions[i * 3 + 1] ?? 0,
        field.positions[i * 3 + 2] ?? 0,
      )
      dummy.scale.setScalar(field.scales[i] ?? 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [field, moteCount])

  useEffect(
    () => () => {
      mote.geometry.dispose()
      material.dispose()
    },
    [mote, material],
  )

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
    if (ref.current) ref.current.rotation.y += delta * active.spin
    time.value += delta
  })

  // An emptied field is a theme, not an error state — `void` is a row in the catalogue. Mounting a
  // zero-instance mesh for it would leave a draw call and a material behind for nothing.
  if (moteCount === 0) return null

  return (
    <instancedMesh ref={ref} args={[mote.geometry, material, moteCount]} frustumCulled={false} />
  )
}
