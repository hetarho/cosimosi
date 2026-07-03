// Filament body: the synapse fat-line. The look is an additive, per-vertex-colored node
// material; the batched ribbon geometry (camera-facing quads whose half-width = synapse
// strength) is owned by the FatLineLayer, which reads only this material. Additive blending
// makes overlapping filaments glow and — unlike three's Line2 fat-line, whose transparent
// path samples the opaque viewport texture the package's custom PostFX pipeline never exposes
// (WebGPU then rejects the bind group) — needs no viewport texture, so it survives the
// pipeline. Per-filament width feeds the geometry; per-filament brightness feeds this color.
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { attributeVec3Node } from '../../tsl.ts'

/** Per-vertex ribbon color (vec3) = emotion-neutral filament tint × brightness; filled by the layer. */
export const FILAMENT_VERTEX_COLOR = 'aFilamentColor'

// The filament body is a `shader` source: an additive node material read per vertex. The
// FatLineLayer supplies the ribbon geometry and disposes this placeholder geometry.
export function createFilamentBodySource(): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      const material = new THREE.MeshBasicNodeMaterial()
      material.colorNode = attributeVec3Node(FILAMENT_VERTEX_COLOR)
      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending
      // The ribbon is a camera-billboarded quad with fixed index winding, so its facing flips
      // with endpoint order and camera angle — draw both sides or ~half the filaments cull away.
      material.side = THREE.DoubleSide
      return new THREE.Mesh(new THREE.BufferGeometry(), material)
    },
  }
}
