import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

import type { VisualBodyKind, VisualBodySource } from '../asset-source.ts'

/**
 * The latest simulation coordinate buffer (interleaved xyz, stride 3). A mutable ref the
 * worker bridge swaps between frames — the layer reads it in useFrame, so coordinates never
 * pass through React state or a store (ARCHITECTURE §3.2/§3.3).
 */
export interface CoordinateBufferRef {
  readonly current: Float32Array | null
}

/** A per-instance vertex attribute uploaded to the instanced geometry, read by the body's TSL material. */
export interface InstanceAttributeChannel {
  readonly name: string
  readonly array: Float32Array
  readonly itemSize: number
}

/**
 * Per-instance appearance channels (§3.3): a per-instance uniform scale plus arbitrary named
 * attributes. Values recompute only when the read model / universe time changes — never per
 * frame — so the arrays' identity is the upload trigger, not the frame loop.
 */
export interface InstanceChannels {
  /** Per-instance uniform scale (world size); overrides the flat `scale` when present. */
  readonly scales?: ArrayLike<number> | null
  /** Per-instance attributes fed to the body material as instance attributes. */
  readonly attributes?: readonly InstanceAttributeChannel[]
}

export interface InstancedNodeLayerProps {
  /** Body port (§3.4): the node body comes from a VisualBodySource, never a direct import. */
  readonly source: VisualBodySource
  readonly bodyId: string
  /** Which asset-source kind to request (star = shader, cell-star = primitive). */
  readonly kind?: VisualBodyKind
  /** Active node count; nodes occupy buffer indices [firstNodeIndex, firstNodeIndex+count). */
  readonly count: number
  readonly positions: CoordinateBufferRef
  readonly firstNodeIndex?: number
  readonly scale?: number
  /** Optional per-instance appearance (size/tint/brightness/seed) for shader bodies. */
  readonly channels?: InstanceChannels
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
  kind = 'primitive',
  count,
  positions,
  firstNodeIndex = 0,
  scale = 1,
  channels,
  onNodePointerDown,
  onNodeDoubleClick,
}: InstancedNodeLayerProps) {
  const [body, setBody] = useState<THREE.Mesh | null>(null)
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  // A zero-scale matrix hides an instance whose coordinate isn't in the live buffer yet, keeping its
  // slot so the instanceId still equals the node index for picking (a separate matrix, so the
  // uniform-scale `matrix` composed once below is never clobbered).
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  // InstancedMesh needs a fixed instance capacity at construction; size it to the active
  // count (min 1) and recreate via `key` when the count changes — graphs refetch rarely.
  const instanceCount = Math.max(1, count)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(source.resolve({ kind, id: bodyId })).then((object) => {
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
  }, [source, bodyId, kind])

  // Disposal is keyed on the adopted body and runs in this effect's cleanup — i.e. after the
  // commit that swapped the mesh to a new body — so a mounted InstancedMesh never draws
  // geometry/material that were already disposed.
  useEffect(() => {
    if (!body) return
    return () => disposeBody(body)
  }, [body])

  // Per-instance attributes ride the geometry, uploaded whenever the channels (and the adopted
  // body) change — not per frame. When the size is unchanged (the hot path: a per-tick channel
  // update on a stable graph) the live attribute's buffer is reused in place; a fresh
  // InstancedBufferAttribute is created only when the instance count changes — otherwise every
  // read-model change would orphan a GPU buffer on the long-lived shared geometry. count <= 0
  // uploads nothing (the mesh is hidden and a zero-length attribute mismatches the capacity).
  //
  // This runs in a LAYOUT effect, not a passive one, to close a mount-order race: `body` is
  // adopted asynchronously, so the mesh joins the scene on a fresh commit — and the node-based
  // render/bloom pipeline (PostFX) builds each object's shader on its first `useFrame` render,
  // reading the instance attributes off the geometry then. A passive effect can flush *after*
  // that first rAF, so the shader gets built against attribute-less geometry ("attribute not
  // found on geometry") and the node builder caches that broken build → the body renders blank
  // until a later rebuild. A layout effect attaches the attributes synchronously before the next
  // paint/rAF, so the first shader build always sees them (intermittent on remount otherwise).
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !body || count <= 0) return
    let added = false
    for (const channel of channels?.attributes ?? []) {
      const existing = mesh.geometry.getAttribute(channel.name) as THREE.InstancedBufferAttribute | undefined
      if (existing && existing.array.length === channel.array.length) {
        ;(existing.array as Float32Array).set(channel.array)
        existing.needsUpdate = true
      } else {
        // A count change keeps the memoized body geometry, so the previous attribute is still
        // attached — dispose its GPU buffer before replacing it, or it leaks (the body's
        // dispose cleanup runs only on unmount/body swap, not on a count change).
        existing?.dispose()
        mesh.geometry.setAttribute(channel.name, new THREE.InstancedBufferAttribute(channel.array, channel.itemSize))
        added = true
      }
    }
    // A newly attached/replaced attribute changes the geometry's attribute set: invalidate any
    // shader the node builder may already have compiled against the prior set, so it recompiles
    // against the now-complete geometry (belt-and-suspenders alongside the layout-effect ordering).
    if (added && !Array.isArray(mesh.material)) mesh.material.needsUpdate = true
  }, [body, channels, instanceCount, count])

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
    const scales = channels?.scales ?? null
    // Uniform-scale path (e.g. cell-stars): compose the scale once, then only the translation
    // column changes per instance. Per-instance scales (stars) recompose the matrix each instance.
    if (!scales) matrix.makeScale(scale, scale, scale)
    for (let i = 0; i < count; i++) {
      const offset = (firstNodeIndex + i) * 3
      // No live coordinate for this node yet — e.g. an optimistic launch grew the store before the
      // next GetUniverse read grew the buffer. Hide it at zero scale (keeping its instance slot, so
      // the instanceId still maps to the node index for picking) rather than drawing it at origin.
      if (offset < 0 || offset + 2 >= buffer.length) {
        mesh.setMatrixAt(i, zeroMatrix)
        continue
      }
      if (scales) {
        const size = scales[i] ?? scale
        matrix.makeScale(size, size, size)
      }
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
