import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

import type { CoordinateBufferRef } from './InstancedNodeLayer.tsx'

export interface EdgeLineLayerProps {
  /** Flat [a0, b0, a1, b1, …] endpoint node indices (stride-3 units into the buffer). */
  readonly endpointPairs: ArrayLike<number>
  /** Active edge count — the vertex buffer is sized to it, so no edge is ever dropped. */
  readonly count: number
  readonly positions: CoordinateBufferRef
  readonly color?: THREE.ColorRepresentation
}

// Shared R3F layer: neuron↔neuron edges as plain GPU line segments — THREE.LineSegments +
// LineBasicNodeMaterial over a `position` BufferGeometry (2 verts per edge). Endpoints are
// READ per frame from the coordinate buffer; the caller supplies which node-index pairs to
// connect, so this layer draws whatever it is handed. Deliberately NOT the Line2 fat-line
// path: that material blends against the opaque viewport mip texture, which isn't available
// under the package's custom PostFX RenderPipeline and makes WebGPU reject the bind group.
// Lines are 1px here (WebGPU basic lines); fat-line width/brightness = synapse strength is a
// later refinement. raycast is a no-op so picking stays on the instanced nodes; frustumCulled
// off because bounds are never recomputed per frame.
export function EdgeLineLayer({ endpointPairs, count, positions, color = '#ffffff' }: EdgeLineLayerProps) {
  const vertexCapacity = Math.max(1, count) * 2
  const linePositions = useMemo(() => new Float32Array(vertexCapacity * 3), [vertexCapacity])
  const geometry = useMemo(() => {
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeometry.setDrawRange(0, 0)
    return lineGeometry
  }, [linePositions])
  const material = useMemo(() => new THREE.LineBasicNodeMaterial({ color }), [color])
  const mesh = useMemo(() => {
    const segments = new THREE.LineSegments(geometry, material)
    segments.frustumCulled = false
    segments.raycast = () => {}
    // Start hidden; useFrame reveals it once it has real endpoints to draw.
    segments.visible = false
    return segments
  }, [geometry, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const buffer = positions.current
    const edges = buffer ? Math.min(count, vertexCapacity / 2) : 0
    if (edges <= 0) {
      // Hide rather than draw a 0-vertex range — a 0-count geometry trips the WebGPU
      // backend; an invisible mesh is skipped by the render pass entirely.
      mesh.visible = false
      return
    }
    for (let edge = 0; edge < edges; edge++) {
      const aOffset = (endpointPairs[edge * 2] ?? 0) * 3
      const bOffset = (endpointPairs[edge * 2 + 1] ?? 0) * 3
      const target = edge * 6
      linePositions[target] = buffer![aOffset] ?? 0
      linePositions[target + 1] = buffer![aOffset + 1] ?? 0
      linePositions[target + 2] = buffer![aOffset + 2] ?? 0
      linePositions[target + 3] = buffer![bOffset] ?? 0
      linePositions[target + 4] = buffer![bOffset + 1] ?? 0
      linePositions[target + 5] = buffer![bOffset + 2] ?? 0
    }
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute
    attribute.needsUpdate = true
    geometry.setDrawRange(0, edges * 2)
    mesh.visible = true
  })

  return <primitive object={mesh} />
}
