import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

import type { VisualBodyKind, VisualBodySource } from '../asset-source.ts'
import { FILAMENT_VERTEX_COLOR } from '../assets/bodies/filament-body.ts'
import type { CoordinateBufferRef } from './InstancedNodeLayer.tsx'

// Fallback axes for the billboard perpendicular when the edge is seen end-on (view ∥ edge).
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0)

export interface FatLineLayerProps {
  /** Body port (§3.4): the fat-line material comes from a VisualBodySource, never a direct import. */
  readonly source: VisualBodySource
  readonly bodyId: string
  readonly kind?: VisualBodyKind
  /** Flat [a0, b0, a1, b1, …] endpoint node indices (stride-3 units into the buffer). */
  readonly endpointPairs: ArrayLike<number>
  /** Active edge count — the ribbon geometry is sized to it, so no edge is ever dropped. */
  readonly count: number
  readonly positions: CoordinateBufferRef
  /** Per-edge half-width in world units (stride 1). */
  readonly widths: ArrayLike<number>
  /** Per-edge ribbon color (stride 3, rgb) — tint × brightness. */
  readonly colors: ArrayLike<number>
}

// Shared R3F layer: neuron↔neuron fat-lines as one batched, camera-facing ribbon mesh (4
// verts / 2 tris per edge). Endpoints are READ per frame from the coordinate buffer and the
// quad is billboarded toward the camera, so a stronger synapse's greater half-width always
// reads as a thicker line regardless of view. The caller supplies which node-index pairs to
// connect (only neuron slots, structurally excluding a star↔star line [I4][I6]) plus the
// per-edge width/color channels. The material comes through the asset-source port; this layer
// owns the batched geometry (and disposes the body's placeholder geometry). raycast is a
// no-op so picking stays on the instanced nodes; frustumCulled off because bounds are never
// recomputed per frame.
export function FatLineLayer({
  source,
  bodyId,
  kind = 'shader',
  endpointPairs,
  count,
  positions,
  widths,
  colors,
}: FatLineLayerProps) {
  const [material, setMaterial] = useState<THREE.Material | null>(null)
  const capacity = Math.max(1, count)

  const geometry = useMemo(() => {
    const ribbon = new THREE.BufferGeometry()
    ribbon.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 4 * 3), 3))
    ribbon.setAttribute(FILAMENT_VERTEX_COLOR, new THREE.BufferAttribute(new Float32Array(capacity * 4 * 3), 3))
    const index = new Uint32Array(capacity * 6)
    for (let edge = 0; edge < capacity; edge++) {
      const base = edge * 4
      const slot = edge * 6
      index[slot] = base
      index[slot + 1] = base + 1
      index[slot + 2] = base + 2
      index[slot + 3] = base + 2
      index[slot + 4] = base + 1
      index[slot + 5] = base + 3
    }
    ribbon.setIndex(new THREE.BufferAttribute(index, 1))
    ribbon.setDrawRange(0, 0)
    return ribbon
  }, [capacity])

  useEffect(() => {
    let cancelled = false
    Promise.resolve(source.resolve({ kind, id: bodyId })).then((object) => {
      const mesh = object instanceof THREE.Mesh ? object : null
      // The layer owns the ribbon geometry; adopt only the material and release the body's
      // placeholder geometry (and the whole object — geometry and material — if a source yielded
      // a non-Mesh or resolved after unmount).
      if (cancelled || !mesh) {
        object.traverse((child) => {
          const asMesh = child as THREE.Mesh
          if (!asMesh.isMesh) return
          asMesh.geometry.dispose()
          const bodyMaterial = asMesh.material
          if (Array.isArray(bodyMaterial)) bodyMaterial.forEach((entry) => entry.dispose())
          else bodyMaterial.dispose()
        })
        return
      }
      mesh.geometry.dispose()
      setMaterial(mesh.material as THREE.Material)
    })
    return () => {
      cancelled = true
      setMaterial(null)
    }
  }, [source, bodyId, kind])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    if (!material) return
    return () => material.dispose()
  }, [material])

  // Per-edge colors ride the geometry, uploaded whenever the color channel changes — not per
  // frame (the read model / universe time changes rarely). All four verts of an edge share it.
  useEffect(() => {
    const attribute = geometry.getAttribute(FILAMENT_VERTEX_COLOR) as THREE.BufferAttribute
    const target = attribute.array as Float32Array
    const edges = Math.min(capacity, Math.floor(colors.length / 3))
    for (let edge = 0; edge < edges; edge++) {
      const r = colors[edge * 3] ?? 0
      const g = colors[edge * 3 + 1] ?? 0
      const b = colors[edge * 3 + 2] ?? 0
      const base = edge * 12
      for (let corner = 0; corner < 4; corner++) {
        target[base + corner * 3] = r
        target[base + corner * 3 + 1] = g
        target[base + corner * 3 + 2] = b
      }
    }
    attribute.needsUpdate = true
  }, [geometry, colors, capacity])

  const mesh = useMemo(() => {
    if (!material) return null
    const ribbon = new THREE.Mesh(geometry, material)
    ribbon.frustumCulled = false
    ribbon.raycast = () => {}
    ribbon.visible = false
    return ribbon
  }, [geometry, material])

  const scratch = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), cam: new THREE.Vector3(), dir: new THREE.Vector3(), view: new THREE.Vector3(), perp: new THREE.Vector3() }),
    [],
  )

  useFrame((state) => {
    if (!mesh) return
    const buffer = positions.current
    const edges = buffer ? Math.min(count, capacity) : 0
    if (edges <= 0) {
      // Hide rather than draw a 0-vertex range — a 0-count geometry trips the WebGPU backend.
      mesh.visible = false
      return
    }
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute
    const target = attribute.array as Float32Array
    state.camera.getWorldPosition(scratch.cam)
    for (let edge = 0; edge < edges; edge++) {
      const aOffset = (endpointPairs[edge * 2] ?? 0) * 3
      const bOffset = (endpointPairs[edge * 2 + 1] ?? 0) * 3
      scratch.a.set(buffer![aOffset] ?? 0, buffer![aOffset + 1] ?? 0, buffer![aOffset + 2] ?? 0)
      scratch.b.set(buffer![bOffset] ?? 0, buffer![bOffset + 1] ?? 0, buffer![bOffset + 2] ?? 0)
      scratch.dir.subVectors(scratch.b, scratch.a)
      // Face the ribbon toward the camera from the edge midpoint, then offset the two ends by
      // the half-width along the screen-perpendicular (edge × view). When the view ray is nearly
      // parallel to the edge (seen end-on) that cross product is unstable — near zero yet non-
      // zero — which would flicker; fall back to a stable world-axis perpendicular so the ribbon
      // keeps its width instead of shimmering. A truly coincident edge (a == b) stays invisible.
      scratch.view.copy(scratch.cam).sub(scratch.a).addScaledVector(scratch.dir, -0.5)
      scratch.perp.crossVectors(scratch.dir, scratch.view)
      const denom = scratch.dir.length() * scratch.view.length()
      if (denom < 1e-9 || scratch.perp.length() / denom < 1e-2) {
        scratch.perp.crossVectors(scratch.dir, WORLD_UP)
        if (scratch.perp.length() < 1e-6) scratch.perp.crossVectors(scratch.dir, WORLD_RIGHT)
      }
      const length = scratch.perp.length()
      if (length > 1e-6) scratch.perp.multiplyScalar((widths[edge] ?? 0) / length)
      else scratch.perp.set(0, 0, 0)
      const base = edge * 12
      writeVertex(target, base, scratch.a, scratch.perp, -1)
      writeVertex(target, base + 3, scratch.a, scratch.perp, 1)
      writeVertex(target, base + 6, scratch.b, scratch.perp, -1)
      writeVertex(target, base + 9, scratch.b, scratch.perp, 1)
    }
    attribute.needsUpdate = true
    geometry.setDrawRange(0, edges * 6)
    mesh.visible = true
  })

  if (!mesh) return null
  return <primitive object={mesh} />
}

function writeVertex(target: Float32Array, offset: number, end: THREE.Vector3, perp: THREE.Vector3, side: number) {
  target[offset] = end.x + perp.x * side
  target[offset + 1] = end.y + perp.y * side
  target[offset + 2] = end.z + perp.z * side
}
