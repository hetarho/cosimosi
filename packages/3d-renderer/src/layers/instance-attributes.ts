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

/** Instances an attribute holds room for: the next power of two at or above the count. */
export function instanceAttributeCapacity(count: number): number {
  return count <= 1 ? 1 : 2 ** Math.ceil(Math.log2(count))
}

/**
 * Upload one channel onto the instanced geometry. While the live attribute has room, copy into
 * its buffer and flag it, unless that buffer already holds this very array; the unused tail past
 * the drawn count is never read. Outgrowing it replaces the attribute with one sized to the next
 * power of two, so a launch or a release that moves the count by a few reuses the GPU buffer. The
 * return value says whether the geometry's attribute set changed.
 */
export function uploadInstanceAttribute(
  geometry: THREE.BufferGeometry,
  channel: InstanceAttributeUpload,
): boolean {
  const existing = geometry.getAttribute(channel.name) as THREE.InstancedBufferAttribute | undefined
  if (
    existing &&
    existing.itemSize === channel.itemSize &&
    existing.array.length >= channel.array.length
  ) {
    if (uploadedFrom.get(existing) === channel.array) return false
    ;(existing.array as Float32Array).set(channel.array)
    existing.needsUpdate = true
    uploadedFrom.set(existing, channel.array)
    return false
  }

  // The memoized body geometry outlives a count change, so the previous attribute is still attached
  // — dispose its GPU buffer before replacing it, or it leaks (the body's disposal cleanup runs only
  // on unmount/body swap, not on a count change).
  existing?.dispose()
  const instances = channel.array.length / channel.itemSize
  const array = new Float32Array(instanceAttributeCapacity(instances) * channel.itemSize)
  array.set(channel.array)
  const attribute = new THREE.InstancedBufferAttribute(array, channel.itemSize)
  uploadedFrom.set(attribute, channel.array)
  geometry.setAttribute(channel.name, attribute)
  return true
}
