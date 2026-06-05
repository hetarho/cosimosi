// Deterministic per-star seed derived from the memory id (spec 08). Single source:
// spec 10's star mapper and the optimistic-record flow both import THIS helper so
// the same id always yields the same seed → the same star shape (reproducibility).
// Server `visual_spec` is MVP-unused (v1). Pure: no three/React/DOM.

/** seedFromId(id) → a stable value in [0, 1) (FNV-1a 32-bit, normalized). */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}
