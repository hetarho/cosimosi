import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../asset-source.ts'

/**
 * The latest simulation coordinate buffer (interleaved xyz, stride 3). A mutable ref the
 * worker bridge swaps between frames — the layer reads it in useFrame, so coordinates never
 * pass through React state or a store (ARCHITECTURE §3.2/§3.3).
 */
export interface CoordinateBufferRef {
  readonly current: Float32Array | null
}

export interface InstancedNodeLayerProps {
  /** Body port (§3.4): the node body comes from a VisualBodySource, never a direct import. */
  readonly source: VisualBodySource
  readonly bodyId: string
  /** Active node count; nodes occupy buffer indices [firstNodeIndex, firstNodeIndex+count). */
  readonly count: number
  readonly positions: CoordinateBufferRef
  readonly firstNodeIndex?: number
  readonly scale?: number
  readonly onNodePointerDown?: (nodeIndex: number) => void
  readonly onNodeDoubleClick?: (nodeIndex: number) => void
}

// Shared R3F layer: data-driven instanced nodes. One InstancedMesh sized to the active node
// count — mirroring StarField's allocation. (A fixed 4096-capacity InstancedMesh started at
// count 0 makes the WebGPU backend build an invalid object bind group; sizing to the real
// count and hiding the mesh until its matrices are written avoids that.) Positions are READ
// per frame from the coordinate buffer into instance matrices, so coordinates never pass
// through React state or a store, keeping layout emergent [I5]. The body resolves through the
// asset-source port; its geometry/material are owned (disposed) by this layer.
export function InstancedNodeLayer({
  source,
  bodyId,
  count,
  positions,
  firstNodeIndex = 0,
  scale = 1,
  onNodePointerDown,
  onNodeDoubleClick,
}: InstancedNodeLayerProps) {
  const [body, setBody] = useState<THREE.Mesh | null>(null)
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  // InstancedMesh needs a fixed instance capacity at construction; size it to the active
  // count (min 1) and recreate via `key` when the count changes — graphs refetch rarely.
  const instanceCount = Math.max(1, count)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(source.resolve({ kind: 'primitive', id: bodyId })).then((object) => {
      const mesh = object instanceof THREE.Mesh ? object : null
      if (cancelled || !mesh) {
        // Not adopted (unmounted meanwhile, or a source yielded a non-Mesh) — release it.
        disposeBody(object)
        return
      }
      setBody(mesh)
    })
    return () => {
      cancelled = true
      setBody(null)
    }
  }, [source, bodyId])

  // Disposal is keyed on the adopted body and runs in this effect's cleanup — i.e. after the
  // commit that swapped the mesh to a new body — so a mounted InstancedMesh never draws
  // geometry/material that were already disposed.
  useEffect(() => {
    if (!body) return
    return () => disposeBody(body)
  }, [body])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const buffer = positions.current
    if (!buffer || count <= 0) {
      // Hide rather than draw 0 instances — a 0-instance InstancedMesh trips the WebGPU
      // backend; an invisible mesh is skipped by the render pass entirely.
      mesh.visible = false
      return
    }
    // Uniform scale is shared by every instance; compose it once, then only the translation
    // column changes per instance.
    matrix.makeScale(scale, scale, scale)
    for (let i = 0; i < count; i++) {
      const offset = (firstNodeIndex + i) * 3
      matrix.setPosition(buffer[offset] ?? 0, buffer[offset + 1] ?? 0, buffer[offset + 2] ?? 0)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.count = count
    mesh.visible = true
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!body) return null

  // Single mesh, so the instanceId IS the node index; firstNodeIndex only offsets the buffer.
  const pick = (instanceId: number | undefined): number | null =>
    instanceId !== undefined && instanceId < count ? instanceId : null

  return (
    <instancedMesh
      key={instanceCount}
      ref={(mesh: THREE.InstancedMesh | null) => {
        meshRef.current = mesh
        if (mesh) {
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          mesh.count = 0
          mesh.visible = false
        }
      }}
      args={[body.geometry, body.material, instanceCount]}
      frustumCulled={false}
      onPointerDown={
        onNodePointerDown
          ? (event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation()
              const index = pick(event.instanceId)
              if (index !== null) onNodePointerDown(index)
            }
          : undefined
      }
      onDoubleClick={
        onNodeDoubleClick
          ? (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation()
              const index = pick(event.instanceId)
              if (index !== null) onNodeDoubleClick(index)
            }
          : undefined
      }
    />
  )
}

function disposeBody(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
  })
}
