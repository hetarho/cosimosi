// Cell-star body: the neuron point. A seedless unit sphere with a constant cool color and NO
// emotion color and NO per-neuron seed-form — a neuron carries information, not emotion, and is
// not a reconsolidation target [V5][I3]. The layer applies the constant point size as a uniform
// scale; position comes from the force-sim via the canvas [I5].
//
// The LOOK is a membrane, not a bead: the interior sits dim and the silhouette carries the light,
// so a neuron reads as a small cell holding something rather than a plastic dot. And it does not
// move — the memory star breathes, the neuron holds still. That contrast is the design: what a
// universe feels is alive; what it knows is stable. TSL only (one source → WGSL + GLSL, §3.3).
import { abs, float, mix, normalView, pow } from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { uniformColorNode } from '../../tsl.ts'

// Dim, cool dust color — content (a fixed look), not config tuning; kept off values.yaml the
// way the skin palettes are. Emotion never sets a cell-star color [I3].
const CELL_STAR_COLOR = '#9fb4ff'

// The membrane grammar: how far the interior falls under its own rim, how thin that rim reads, and
// how much light the rim catches from the bloom pass. Visual grammar, so it lives in code with the
// color rather than in values.yaml.
const CORE_DIM = 0.42
const RIM_SHARPNESS = 2.2
const RIM_GAIN = 1.3

// The cell-star body is a `primitive` source: an instanced seedless point (a low-poly unit
// sphere), scaled uniformly by the layer to the constant `cell_star_point_size`.
export function createCellStarBodySource(): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      const material = new THREE.MeshBasicNodeMaterial()
      // View-space grazing: the normal turns side-on at the silhouette, so this rises to 1 exactly
      // at the outline and stays 0 across the face — a rim that holds from any camera angle without
      // a light in the scene (there are none; this body IS its own light).
      const rim = pow(float(1).sub(abs(normalView.z)), float(RIM_SHARPNESS))
      material.colorNode = uniformColorNode(CELL_STAR_COLOR).mul(
        mix(float(CORE_DIM), float(RIM_GAIN), rim),
      )
      return new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), material)
    },
  }
}
