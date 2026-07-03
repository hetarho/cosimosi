import * as THREE from 'three/webgpu'

import type { VisualBodyRequest, VisualBodySource } from './asset-source.ts'

export interface PrimitiveBodySpec {
  readonly color?: THREE.ColorRepresentation
  readonly radius?: number
}

// Generic body source for the asset-source port (§3.4): every id resolves to a plain unlit
// sphere (scenes here carry no lights). Consumers bind this generic source today; a richer
// source (shader/glTF bodies) later replaces the binding without touching any layer.
// Each resolve returns a FRESH mesh — the consumer owns its disposal.
export function createPrimitiveBodySource(
  specs: Readonly<Record<string, PrimitiveBodySpec>> = {},
): VisualBodySource {
  return {
    resolve(request: VisualBodyRequest): THREE.Object3D {
      const spec = specs[request.id] ?? {}
      const geometry = new THREE.SphereGeometry(spec.radius ?? 0.5, 16, 16)
      const material = new THREE.MeshBasicNodeMaterial()
      material.color.set(spec.color ?? '#dfe8ff')
      return new THREE.Mesh(geometry, material)
    },
  }
}
