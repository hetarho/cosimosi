import type * as THREE from 'three/webgpu'

import { syncVertexScale } from './instance-visibility.ts'

/** The buffer's xyz interleave — slot n's coordinates start at n * COORDINATE_STRIDE. */
export const COORDINATE_STRIDE = 3

/**
 * Optional per-frame position derivation: write the instance's world xyz into `out` and
 * return true, or return false to hide the instance this frame. Layers whose instances are
 * PROJECTIONS of buffer slots (e.g. a gist body copying its memory's x, y with a derived,
 * possibly animating z) supply this instead of the default contiguous-slot read. Called
 * inside useFrame — it must not allocate or touch React state.
 */
export type InstancePositionMapper = (
  instanceIndex: number,
  buffer: Float32Array,
  out: Float32Array,
  elapsedSeconds: number,
) => boolean

/**
 * One frame's compose inputs. The layer owns a single instance and rewrites its fields every frame,
 * so composing allocates nothing.
 */
export interface ComposeInstancesInput {
  buffer: Float32Array
  count: number
  firstNodeIndex: number
  scale: number
  scales: ArrayLike<number> | null
  vertexScales: Float32Array | null
  getInstancePosition: InstancePositionMapper | undefined
  elapsed: number
  readonly matrix: THREE.Matrix4
  readonly zeroMatrix: THREE.Matrix4
  readonly derivedPosition: Float32Array
}

/**
 * Drop the mesh's cached pick volume. three computes an InstancedMesh's bounding sphere lazily on
 * the first raycast and never again, so a volume cached before coordinates arrived, or before
 * instances moved, would make every later tap outside it miss. Recomputation stays lazy: it runs on
 * the next pointer event, never in the frame loop.
 */
export function invalidatePickVolume(mesh: THREE.InstancedMesh): void {
  mesh.boundingSphere = null
  mesh.boundingBox = null
}

/**
 * Compose every instance matrix from the coordinate buffer (or the layer's position mapper),
 * request the matrix upload and invalidate the pick volume. A node with no live coordinate yet
 * hides at zero scale and keeps its slot, so the instanceId still equals the node index for
 * picking. Returns whether the vertex-scale attribute changed and needs an upload.
 */
export function composeInstances(mesh: THREE.InstancedMesh, input: ComposeInstancesInput): boolean {
  const { buffer, count, firstNodeIndex, scale, scales, vertexScales, getInstancePosition } = input
  const { matrix, zeroMatrix, derivedPosition } = input
  let vertexScalesChanged = false
  // Uniform-scale path (e.g. cell-stars): compose the scale once, then only the translation column
  // changes per instance. Per-instance scales (stars) recompose the matrix each instance.
  if (!scales) matrix.makeScale(scale, scale, scale)
  for (let i = 0; i < count; i++) {
    let x: number
    let y: number
    let z: number
    if (getInstancePosition) {
      if (!getInstancePosition(i, buffer, derivedPosition, input.elapsed)) {
        vertexScalesChanged = syncVertexScale(vertexScales, i, 0) || vertexScalesChanged
        mesh.setMatrixAt(i, zeroMatrix)
        continue
      }
      x = derivedPosition[0] ?? 0
      y = derivedPosition[1] ?? 0
      z = derivedPosition[2] ?? 0
    } else {
      const offset = (firstNodeIndex + i) * COORDINATE_STRIDE
      if (offset < 0 || offset + 2 >= buffer.length) {
        vertexScalesChanged = syncVertexScale(vertexScales, i, 0) || vertexScalesChanged
        mesh.setMatrixAt(i, zeroMatrix)
        continue
      }
      x = buffer[offset] ?? 0
      y = buffer[offset + 1] ?? 0
      z = buffer[offset + 2] ?? 0
    }
    if (scales) {
      const size = scales[i] ?? scale
      vertexScalesChanged = syncVertexScale(vertexScales, i, size) || vertexScalesChanged
      matrix.makeScale(size, size, size)
    } else {
      vertexScalesChanged = syncVertexScale(vertexScales, i, scale) || vertexScalesChanged
    }
    matrix.setPosition(x, y, z)
    mesh.setMatrixAt(i, matrix)
  }
  mesh.count = count
  mesh.visible = true
  mesh.instanceMatrix.needsUpdate = true
  invalidatePickVolume(mesh)
  return vertexScalesChanged
}
