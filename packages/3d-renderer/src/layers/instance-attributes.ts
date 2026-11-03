import * as THREE from 'three/webgpu'

/** One per-instance attribute's contents, as a layer's channels carry it. */
export interface InstanceAttributeUpload {
  readonly name: string
  readonly array: Float32Array
  readonly itemSize: number
}

// The producer array each attribute last took its contents from. Channels are replaced, never
// mutated in place, so the same array means the same contents and nothing to upload.
const uploadedFrom = new WeakMap<THREE.BufferAttribute, Float32Array>()

/**
 * Upload one channel onto the instanced geometry. Same length: copy into the live attribute's
 * buffer and flag it, unless that buffer already holds this very array. A count change replaces
 * the attribute, so the return value says whether the geometry's attribute set changed.
 */
export function uploadInstanceAttribute(
  geometry: THREE.BufferGeometry,
  channel: InstanceAttributeUpload,
): boolean {
  const existing = geometry.getAttribute(channel.name) as THREE.InstancedBufferAttribute | undefined
  if (existing && existing.array.length === channel.array.length) {
    if (uploadedFrom.get(existing) === channel.array) return false
    ;(existing.array as Float32Array).set(channel.array)
    existing.needsUpdate = true
    uploadedFrom.set(existing, channel.array)
    return false
  }

  // A count change keeps the memoized body geometry, so the previous attribute is still attached —
  // dispose its GPU buffer before replacing it, or it leaks (the body's disposal cleanup runs only
  // on unmount/body swap, not on a count change).
  existing?.dispose()
  const attribute = new THREE.InstancedBufferAttribute(channel.array, channel.itemSize)
  uploadedFrom.set(attribute, channel.array)
  geometry.setAttribute(channel.name, attribute)
  return true
}
