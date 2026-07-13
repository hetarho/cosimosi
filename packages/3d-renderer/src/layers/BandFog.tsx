import { useEffect, useMemo } from 'react'
import { float, positionLocal, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

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

export function BandFog({ zMin, zMax, radius, intensity }: BandFogProps) {
  const group = useMemo(() => {
    const container = new THREE.Group()
    const span = Math.max(0.001, zMax - zMin)
    for (let i = 0; i < SLICE_COUNT; i++) {
      // Slice fraction across the gap, and a 1-|t| profile peaking at the gap center and
      // reaching 0 at both band edges — the same envelope the layers rise into.
      const t = i / (SLICE_COUNT - 1)
      const profile = 1 - Math.abs(t * 2 - 1)
      if (profile <= 0) continue
      const material = new THREE.MeshBasicNodeMaterial()
      // Radial falloff over the disc: distance from the local center, faded to the rim.
      const radial = positionLocal.xy.length().div(float(radius)).clamp(0, 1)
      const glow = float(1).sub(radial).clamp(0, 1).pow(float(RADIAL_FALLOFF))
      const strength = float(profile * intensity)
      material.colorNode = FOG_TINT.mul(glow).mul(strength)
      material.opacityNode = glow.mul(strength)
      material.transparent = true
      material.blending = THREE.AdditiveBlending
      material.depthWrite = false
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), material)
      // Behind the bodies in the draw order so the haze never washes a star's core.
      disc.renderOrder = -1
      // Invisible to the raycaster: the discs span the whole scene and would otherwise
      // swallow every click aimed at a body behind them.
      disc.raycast = () => {}
      disc.position.set(0, 0, zMin + t * span)
      container.add(disc)
    }
    return container
  }, [zMin, zMax, radius, intensity])

  useEffect(
    () => () => {
      for (const child of group.children) {
        const disc = child as THREE.Mesh
        disc.geometry.dispose()
        const material = disc.material
        if (!Array.isArray(material)) material.dispose()
      }
    },
    [group],
  )

  return <primitive object={group} />
}
