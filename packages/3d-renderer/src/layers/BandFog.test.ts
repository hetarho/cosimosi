import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three/webgpu'

import { BAND_FOG_STRENGTH, createBandFogMesh, disposeBandFogMesh } from './BandFog.tsx'

describe('BandFog construction', () => {
  it('stacks every haze slice into one two-sided, non-picking additive instanced draw', () => {
    const mesh = createBandFogMesh({ zMin: 10, zMax: 15, radius: 120, intensity: 0.35 })

    // One draw and one pipeline for the whole gap: the slices differ by an instance attribute,
    // never by a second material — a distinct node graph per slice is a distinct WGSL compile.
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh)
    expect(mesh.count).toBe(4)
    expect(mesh.geometry).toBeInstanceOf(THREE.CircleGeometry)

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const z: number[] = []
    for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, matrix)
      z.push(position.setFromMatrixPosition(matrix).z)
    }
    expect(z).toEqual([11, 12, 13, 14])

    // The 1-|t| envelope across the gap: strongest at the center, fading to the band edges.
    const strengths = mesh.geometry.getAttribute(BAND_FOG_STRENGTH)
    expect(strengths).toBeInstanceOf(THREE.InstancedBufferAttribute)
    expect(strengths.count).toBe(mesh.count)
    const values = Array.from({ length: strengths.count }, (_, i) => strengths.getX(i))
    expect(values.map((value) => Number(value.toFixed(3)))).toEqual([0.14, 0.28, 0.28, 0.14])

    const normals = mesh.geometry.getAttribute('normal')
    for (let index = 0; index < normals.count; index++) {
      expect(normals.getZ(index)).toBe(1)
    }

    const material = mesh.material as THREE.MeshBasicNodeMaterial
    expect(material.side).toBe(THREE.DoubleSide)
    // three splits a transparent DoubleSide material into a back pass and a front pass unless told
    // not to — one material is only one draw with this off.
    expect(material.forceSinglePass).toBe(true)
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthTest).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.colorNode).toBeDefined()
    expect(material.opacityNode).toBeDefined()
    expect(mesh.renderOrder).toBe(-1)

    const intersections: THREE.Intersection[] = []
    mesh.raycast(new THREE.Raycaster(), intersections)
    expect(intersections).toEqual([])
  })

  it('disposes the geometry, the material and the instance buffer through the owning cleanup', () => {
    const mesh = createBandFogMesh({ zMin: 10, zMax: 15, radius: 120, intensity: 0.35 })
    const disposals = [
      vi.spyOn(mesh.geometry, 'dispose'),
      vi.spyOn(mesh.material as THREE.Material, 'dispose'),
      vi.spyOn(mesh, 'dispose'),
    ]

    disposeBandFogMesh(mesh)

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce()
  })
})
