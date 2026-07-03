// Cell-star body: the neuron point. A simple, seedless unit sphere with a constant dim dust
// color and NO emotion color and NO per-neuron seed-form — a neuron carries information, not
// emotion, and is not a reconsolidation target [V5][I3]. The layer applies the constant
// point size as a uniform scale; position comes from the force-sim via the canvas [I5].
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'

// Dim, cool dust color — content (a fixed look), not config tuning; kept off values.yaml the
// way the skin palettes are. Emotion never sets a cell-star color [I3].
const CELL_STAR_COLOR = '#9fb4ff'

// The cell-star body is a `primitive` source: an instanced seedless point (a low-poly unit
// sphere), scaled uniformly by the layer to the constant `cell_star_point_size`.
export function createCellStarBodySource(): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      const material = new THREE.MeshBasicNodeMaterial()
      material.color.set(CELL_STAR_COLOR)
      return new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), material)
    },
  }
}
