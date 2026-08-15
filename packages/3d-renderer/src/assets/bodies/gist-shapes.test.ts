import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import {
  DEFAULT_GIST_SHAPE,
  GIST_SHAPES,
  GIST_TRIANGLE_CEILING,
  createGistShapeBodySource,
  resolveGistShape,
} from './gist-shapes.ts'

const resolve = (key: string) =>
  createGistShapeBodySource(key).resolve({ kind: 'shader', id: key }) as THREE.Mesh

const dispose = (mesh: THREE.Mesh) => {
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
}

// The catalogue's contract, not its looks: every entry must actually build (a TSL graph that throws
// only shows up as a blank canvas otherwise), carry a unit-radius mesh so the layer's per-instance
// scale IS the gist size, and keep its key unique — the key is the body id the layer requests.
describe('gist shape catalogue', () => {
  it('keeps every shape key unique', () => {
    const keys = GIST_SHAPES.map((shape) => shape.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds a unit-radius mesh with geometry and material for every shape', () => {
    for (const shape of GIST_SHAPES) {
      const mesh = resolve(shape.key)
      expect(mesh, shape.key).toBeInstanceOf(THREE.Mesh)
      expect(mesh.material, shape.key).toBeDefined()
      mesh.geometry.computeBoundingSphere()
      expect(mesh.geometry.boundingSphere?.radius, shape.key).toBeCloseTo(1, 2)
      dispose(mesh)
    }
  })

  // A gist has no surface to resolve, so a form that reached for tessellation would be spending
  // vertices on detail it cannot show — every look is light on the same plain shell.
  it('keeps every shape at the plain shell it is lit on', () => {
    for (const shape of GIST_SHAPES) {
      const mesh = resolve(shape.key)
      const { index } = mesh.geometry
      const triangles = (index ? index.count : mesh.geometry.getAttribute('position').count) / 3
      expect(triangles, `${shape.key} draws ${triangles} triangles`).toBeLessThanOrEqual(
        GIST_TRIANGLE_CEILING,
      )
      dispose(mesh)
    }
  })

  // The layering the whole family depends on: a gist adds itself to the scene rather than occluding
  // it, so overlapping bodies cannot punch holes in each other or in the hippocampus below. `pearl`
  // is the one deliberate exception — it exists to show what an opaque gist would read as.
  it('keeps the additive, non-depth-writing haze every form but the opaque one wears', () => {
    for (const shape of GIST_SHAPES) {
      const mesh = resolve(shape.key)
      const material = mesh.material as THREE.Material
      if (shape.key === 'pearl') {
        expect(material.transparent).toBe(false)
      } else {
        expect(material.transparent, shape.key).toBe(true)
        expect(material.blending, shape.key).toBe(THREE.AdditiveBlending)
        expect(material.depthWrite, shape.key).toBe(false)
      }
      dispose(mesh)
    }
  })

  it('falls back to the default shape for an unknown key', () => {
    expect(resolveGistShape('no-such-shape').key).toBe(DEFAULT_GIST_SHAPE)
  })

  // The catalogue is not bench-only any more: the universe's own gist bodies are built from a key
  // out of it, and until one is decorated that key is the DEFAULT — so the default has to name a
  // row that exists, or the neocortex renders nothing at all.
  it('builds the look an undecorated universe wears', () => {
    expect(GIST_SHAPES.some((shape) => shape.key === DEFAULT_GIST_SHAPE)).toBe(true)
    const mesh = resolve(DEFAULT_GIST_SHAPE)
    expect(mesh).toBeInstanceOf(THREE.Mesh)
    dispose(mesh)
  })
})
