import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three/webgpu'

import { createBandFogGroup, disposeBandFogGroup } from './BandFog.tsx'

describe('BandFog construction', () => {
  it('builds every horizontal haze slice as a two-sided, non-picking additive depth cue', () => {
    const group = createBandFogGroup({ zMin: 10, zMax: 15, radius: 120, intensity: 0.35 })
    const slices = group.children as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicNodeMaterial>[]

    expect(slices).toHaveLength(4)
    expect(slices.map((slice) => slice.position.z)).toEqual([11, 12, 13, 14])
    expect(new Set(slices.map((slice) => slice.geometry)).size).toBe(slices.length)
    expect(new Set(slices.map((slice) => slice.material)).size).toBe(slices.length)

    for (const slice of slices) {
      expect(slice.geometry).toBeInstanceOf(THREE.CircleGeometry)
      const normals = slice.geometry.getAttribute('normal')
      for (let index = 0; index < normals.count; index++) {
        expect(normals.getZ(index)).toBe(1)
      }
      expect(slice.material.side).toBe(THREE.DoubleSide)
      expect(slice.material.transparent).toBe(true)
      expect(slice.material.blending).toBe(THREE.AdditiveBlending)
      expect(slice.material.depthTest).toBe(true)
      expect(slice.material.depthWrite).toBe(false)
      expect(slice.material.colorNode).toBeDefined()
      expect(slice.material.opacityNode).toBeDefined()
      expect(slice.renderOrder).toBe(-1)

      const intersections: THREE.Intersection[] = []
      slice.raycast(new THREE.Raycaster(), intersections)
      expect(intersections).toEqual([])
    }
  })

  it('disposes each slice geometry and material exactly once through the owning cleanup', () => {
    const group = createBandFogGroup({ zMin: 10, zMax: 15, radius: 120, intensity: 0.35 })
    const disposals = group.children.flatMap((child) => {
      const slice = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>
      return [vi.spyOn(slice.geometry, 'dispose'), vi.spyOn(slice.material, 'dispose')]
    })

    disposeBandFogGroup(group)

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce()
  })
})
