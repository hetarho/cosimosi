import { useEffect, useMemo } from 'react'
import { float, positionGeometry, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { attributeFloatNode } from '../tsl.ts'

// A restrained haze across a z band — the depth cue that makes two stacked universe layers read
// as separated depth ([V9]): a soft glow filling the gap and fading to nothing at the band
// edges, an affordance rather than a wall. Realized as a stack of horizontal glow planes (not a
// box surface, whose top/bottom faces would show nothing and whose sides would read as walls at
// the radius), so the haze is visible from above, below, and the fly-through between bands. Each
// plane writes no depth, adds light (additive) instead of occluding, and is invisible to
// picking, so it can never block a body behind it or steal a click.
export interface BandFogProps {
  /** World-z where the haze starts (the lower layer's ceiling). */
  readonly zMin: number
  /** World-z where the haze ends (the upper layer's floor). */
  readonly zMax: number
  /** Horizontal half-extent the haze covers (matches the field the layers occupy). */
  readonly radius: number
  /** Peak haze strength at the gap's center (0..1). */
  readonly intensity: number
}

// Neutral space-tone — a haze is atmosphere, never an emotion color ([I3]).
const FOG_TINT = vec3(0.45, 0.55, 0.78)
// Horizontal slices stacked across the gap. Enough for the overlap to read as a continuous
// volume from an oblique fly-through; few enough to stay one cheap additive draw each.
const SLICE_COUNT = 6
// Radial softness: brightest at the axis, gone by the field edge (a glow disc, never a wall).
const RADIAL_FALLOFF = 2.2
/** Per-slice haze strength (float, 0..1) — the ONE thing that differs between the discs. */
export const BAND_FOG_STRENGTH = 'aFogStrength'

/** The slice fractions across the gap that actually draw: a 1-|t| profile peaking at the gap
 *  center and reaching 0 at both band edges — the same envelope the layers rise into — so the
 *  two end slices contribute nothing and are never allocated. */
function visibleSlices(): { readonly t: number; readonly profile: number }[] {
  const slices = []
  for (let i = 0; i < SLICE_COUNT; i++) {
    const t = i / (SLICE_COUNT - 1)
    const profile = 1 - Math.abs(t * 2 - 1)
    if (profile > 0) slices.push({ t, profile })
  }
  return slices
}

// Package-internal construction seam: tests inspect the complete draw/pick/resource contract
// without depending on a GPU renderer or a camera implementation.
//
// ONE instanced draw, not one mesh per slice: the discs' node graphs differed only by a constant,
// and every distinct graph is a separate pipeline compile — the currency WebGPU stalls on. Strength
// rides an instanced attribute instead, so adding slices costs instances rather than compiles.
export function createBandFogMesh({
  zMin,
  zMax,
  radius,
  intensity,
}: BandFogProps): THREE.InstancedMesh {
  const span = Math.max(0.001, zMax - zMin)
  const slices = visibleSlices()

  const geometry = new THREE.CircleGeometry(radius, 48)
  const strengths = new Float32Array(slices.length)
  for (const [index, slice] of slices.entries()) strengths[index] = slice.profile * intensity
  geometry.setAttribute(BAND_FOG_STRENGTH, new THREE.InstancedBufferAttribute(strengths, 1))

  const material = new THREE.MeshBasicNodeMaterial()
  // Radial falloff over the disc, off the UNTOUCHED geometry attribute: `positionLocal` carries the
  // instance transform, so an instanced disc would measure its distance from the field's axis
  // rather than from its own center.
  const radial = positionGeometry.xy.length().div(float(radius)).clamp(0, 1)
  const glow = float(1).sub(radial).clamp(0, 1).pow(float(RADIAL_FALLOFF))
  const strength = attributeFloatNode(BAND_FOG_STRENGTH)
  material.colorNode = FOG_TINT.mul(glow).mul(strength)
  material.opacityNode = glow.mul(strength)
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.side = THREE.DoubleSide
  // Without this, three draws every transparent DoubleSide material twice (back faces, then front)
  // to hide sorting artifacts — the mitigation is pointless for additive flat discs, where the sum
  // is order-independent, and it would have doubled the very draw call this layer just collapsed.
  material.forceSinglePass = true

  const mesh = new THREE.InstancedMesh(geometry, material, slices.length)
  const dummy = new THREE.Object3D()
  for (const [index, slice] of slices.entries()) {
    dummy.position.set(0, 0, zMin + slice.t * span)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  // Behind the bodies in the draw order so the haze never washes a star's core.
  mesh.renderOrder = -1
  // Invisible to the raycaster: the discs span the whole scene and would otherwise
  // swallow every click aimed at a body behind them.
  mesh.raycast = () => {}
  return mesh
}

export function disposeBandFogMesh(mesh: THREE.InstancedMesh) {
  mesh.geometry.dispose()
  const material = mesh.material
  if (!Array.isArray(material)) material.dispose()
  mesh.dispose()
}

export function BandFog({ zMin, zMax, radius, intensity }: BandFogProps) {
  // Destructured rather than passed through as `props`: the mesh is rebuilt (and the old one
  // disposed) whenever any of these move, and naming them is what keeps that list complete.
  const mesh = useMemo(
    () => createBandFogMesh({ zMin, zMax, radius, intensity }),
    [zMin, zMax, radius, intensity],
  )

  useEffect(() => () => disposeBandFogMesh(mesh), [mesh])

  return <primitive object={mesh} />
}
