import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { createCellStarBodySource } from './cell-star-body.ts'
import {
  buildFilamentFrame,
  createFilamentBodySource,
  FILAMENT_VERTEX_EDGE,
} from './filament-body.ts'

// The contracts behind the neuron point and the synapse strand, not their looks: each TSL graph must
// actually build (a graph that throws only shows up as a blank canvas), the filament has to keep the
// blending its glow depends on, and the ribbon frame has to match the corner order the layer writes —
// a swapped corner would move the cord's bright centre line onto a rim.
describe('cell-star body', () => {
  it('builds a unit-radius mesh carrying a colour graph', () => {
    const object = createCellStarBodySource().resolve({ kind: 'primitive', id: 'cell-star' })
    expect(object).toBeInstanceOf(THREE.Mesh)
    const mesh = object as THREE.Mesh
    const material = mesh.material as THREE.MeshBasicNodeMaterial
    expect(material.colorNode).toBeDefined()
    mesh.geometry.computeBoundingSphere()
    expect(mesh.geometry.boundingSphere?.radius).toBeCloseTo(1, 2)
    mesh.geometry.dispose()
    material.dispose()
  })
})

describe('filament body', () => {
  it('builds in animated and reduced-motion modes', () => {
    for (const animate of [true, false]) {
      const object = createFilamentBodySource({ animate }).resolve({
        kind: 'shader',
        id: 'filament',
      })
      expect(object, String(animate)).toBeInstanceOf(THREE.Mesh)
      const mesh = object as THREE.Mesh
      expect((mesh.material as THREE.MeshBasicNodeMaterial).colorNode).toBeDefined()
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  })

  it('keeps the additive, double-sided, non-depth-writing glow the pipeline needs', () => {
    const mesh = createFilamentBodySource().resolve({
      kind: 'shader',
      id: 'filament',
    }) as THREE.Mesh
    const material = mesh.material as THREE.Material
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.side).toBe(THREE.DoubleSide)
    mesh.geometry.dispose()
    material.dispose()
  })
})

describe('filament ribbon frame', () => {
  it('names the vertex attribute the body reads', () => {
    expect(FILAMENT_VERTEX_EDGE).toBe('aFilamentEdge')
  })

  it('writes side, along and one shared phase per edge in the layer corner order', () => {
    const frame = buildFilamentFrame(3)
    expect(frame).toHaveLength(3 * 4 * 3)
    for (let edge = 0; edge < 3; edge++) {
      const at = (corner: number) =>
        frame.slice((edge * 4 + corner) * 3, (edge * 4 + corner) * 3 + 3)
      // a(-1) · a(+1) · b(-1) · b(+1) — the two rims are ∓1 and the two ends are 0 / 1.
      expect([at(0)[0], at(1)[0], at(2)[0], at(3)[0]]).toEqual([-1, 1, -1, 1])
      expect([at(0)[1], at(1)[1], at(2)[1], at(3)[1]]).toEqual([0, 0, 1, 1])
      // One phase per EDGE: all four corners share it, or the shimmer would smear across the quad.
      const phase = at(0)[2]
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
      for (const corner of [1, 2, 3]) expect(at(corner)[2]).toBe(phase)
    }
  })

  it('gives neighbouring edges different phases, deterministically', () => {
    const first = buildFilamentFrame(8)
    const second = buildFilamentFrame(8)
    expect(Array.from(first)).toEqual(Array.from(second))
    const phases = Array.from({ length: 8 }, (_, edge) => first[edge * 12 + 2])
    expect(new Set(phases).size).toBe(8)
  })

  it('yields an empty frame for an empty ribbon', () => {
    expect(buildFilamentFrame(0)).toHaveLength(0)
  })
})
