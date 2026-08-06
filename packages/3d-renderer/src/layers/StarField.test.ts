import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import { STAR_FIELD_PROFILE, createStarFieldGeometry } from './StarField.tsx'

// The backdrop is the scene's largest FIXED vertex cost — count × mote, paid on every surface that
// mounts a universe, invisible to any gate that starts from what a memory renders. These pin the
// two things that make it cheap: the mote's topology, and the fact that mobile takes its own count.
describe('star field mote', () => {
  it('builds the mote at the declared subdivision, and pays only its silhouette', () => {
    const geometry = createStarFieldGeometry()
    expect(geometry).toBeInstanceOf(THREE.IcosahedronGeometry)

    // three builds polyhedra non-indexed: 20 × (detail + 1)² faces, three vertices each.
    const detail = VALUES.rendering.starFieldMoteDetail
    const triangles = geometry.getAttribute('position').count / 3
    expect(geometry.getIndex()).toBeNull()
    expect(triangles).toBe(20 * (detail + 1) ** 2)
    // A mote is a handful of pixels; the 8×8 UV sphere this replaced spent 112 triangles on it.
    expect(triangles).toBeLessThan(112)
    geometry.dispose()
  })
})

describe('star field platform profiles', () => {
  it('reads both densities straight from the generated config', () => {
    expect(STAR_FIELD_PROFILE.web).toEqual({
      count: VALUES.rendering.starFieldCount,
      radius: VALUES.rendering.starFieldRadius,
    })
    expect(STAR_FIELD_PROFILE.mobile).toEqual({
      count: VALUES.rendering.starFieldCountMobile,
      radius: VALUES.rendering.starFieldRadiusMobile,
    })
  })

  // The promise §3.5 makes for the native MVP, and the reason the pair exists at all.
  it('gives the native MVP the smaller instance count', () => {
    expect(STAR_FIELD_PROFILE.mobile.count).toBeLessThan(STAR_FIELD_PROFILE.web.count)
  })
})
