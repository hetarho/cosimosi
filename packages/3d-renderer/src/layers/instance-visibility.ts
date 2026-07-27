/**
 * Keep a shader's displacement scale aligned with matrix visibility without forcing a buffer
 * upload on steady frames. Internal to the generic instanced layer.
 */
export function syncVertexScale(
  scales: Float32Array | null,
  index: number,
  value: number,
): boolean {
  if (!scales || scales[index] === value) return false
  scales[index] = value
  return true
}
