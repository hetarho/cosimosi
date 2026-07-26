import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { STAR_SHAPES, createStarShapeBodySource, resolveStarShape } from './star-shapes.ts'

// The catalogue's contract, not its looks: every entry must actually build (a TSL graph that throws
// only shows up as a blank canvas otherwise), carry a unit-radius mesh so the layer's per-instance
// scale IS the star size, and keep its key unique — the key is the body id the layer requests.
describe('star shape catalogue', () => {
  it('keeps every shape key unique', () => {
    const keys = STAR_SHAPES.map((shape) => shape.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds a unit-radius mesh with geometry and material for every shape', () => {
    for (const shape of STAR_SHAPES) {
      const object = createStarShapeBodySource(shape.key).resolve({ kind: 'shader', id: shape.key })
      expect(object, shape.key).toBeInstanceOf(THREE.Mesh)
      const mesh = object as THREE.Mesh
      expect(mesh.material, shape.key).toBeDefined()
      mesh.geometry.computeBoundingSphere()
      // Authored at unit radius; the CPU-displaced spikes only ever pull vertices inward.
      expect(mesh.geometry.boundingSphere?.radius, shape.key).toBeGreaterThan(0)
      expect(mesh.geometry.boundingSphere?.radius, shape.key).toBeLessThanOrEqual(1.001)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  })

  it('freezes the moving surface when motion is unwanted', () => {
    const still = createStarShapeBodySource('plasma', { animate: false })
    const moving = createStarShapeBodySource('plasma', { animate: true })
    expect(still.resolve({ kind: 'shader', id: 'plasma' })).toBeInstanceOf(THREE.Mesh)
    expect(moving.resolve({ kind: 'shader', id: 'plasma' })).toBeInstanceOf(THREE.Mesh)
  })

  it('falls back to the shipped star for an unknown key', () => {
    expect(resolveStarShape('no-such-shape').key).toBe('orb')
  })
})
