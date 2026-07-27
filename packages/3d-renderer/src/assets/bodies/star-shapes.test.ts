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
      // Every candidate is authored inside the unit sphere.
      expect(mesh.geometry.boundingSphere?.radius, shape.key).toBeGreaterThan(0)
      expect(mesh.geometry.boundingSphere?.radius, shape.key).toBeLessThanOrEqual(1.001)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  })

  it('builds every look in animated and reduced-motion modes', () => {
    for (const shape of STAR_SHAPES) {
      const still = createStarShapeBodySource(shape.key, { animate: false }).resolve({
        kind: 'shader',
        id: shape.key,
      })
      const moving = createStarShapeBodySource(shape.key, { animate: true }).resolve({
        kind: 'shader',
        id: shape.key,
      })
      expect(still, shape.key).toBeInstanceOf(THREE.Mesh)
      expect(moving, shape.key).toBeInstanceOf(THREE.Mesh)
      for (const object of [still, moving]) {
        const mesh = object as THREE.Mesh
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
    }
  })

  it('gives the spire exactly eight shortened tips around a broad core', () => {
    const object = createStarShapeBodySource('spire', { animate: false }).resolve({
      kind: 'shader',
      id: 'spire',
    })
    const mesh = object as THREE.Mesh
    const position = mesh.geometry.getAttribute('position')
    const directions = new Set<string>()
    const tipRadii: number[] = []
    const coreRadii: number[] = []
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      const radius = Math.hypot(x, y, z)
      if (radius > 0.89) {
        directions.add(`${Math.sign(x)},${Math.sign(y)},${Math.sign(z)}`)
        tipRadii.push(radius)
      } else {
        coreRadii.push(radius)
      }
    }
    expect(directions).toEqual(
      new Set(['-1,-1,-1', '-1,-1,1', '-1,1,-1', '-1,1,1', '1,-1,-1', '1,-1,1', '1,1,-1', '1,1,1']),
    )
    expect(tipRadii.every((radius) => Math.abs(radius - 0.9) < 0.001)).toBe(true)
    expect(coreRadii.every((radius) => Math.abs(radius - 0.48) < 0.001)).toBe(true)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  })

  it('falls back to the shipped star for an unknown key', () => {
    expect(resolveStarShape('no-such-shape').key).toBe('orb')
  })
})
