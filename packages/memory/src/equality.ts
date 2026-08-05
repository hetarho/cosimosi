import type { UniverseSnapshot } from './mappers.ts'

/**
 * Content equality for the FE domain mirrors — "are these the same facts", not "is this the same
 * object".
 *
 * The read path invalidates on identity, and identity moves on every fetch: protobuf-es hands back
 * a fresh `Message` per response and the DTO→domain mappers allocate fresh records from it. Without
 * a content check, the cheapest event in the system (a no-op refetch on window refocus) buys the
 * most expensive work downstream — a sim worker respawn, a sky shader recompile, full instance
 * re-uploads. These predicates are the seam that stops that chain at its root.
 *
 * Comparison is **structural rather than field-by-field on purpose.** A hand-listed comparison of
 * `EpisodicMemory`'s fields would keep compiling after a field is added to the mirror, and silently
 * report two different memories as equal — a stale universe on screen with no failing test. The
 * mirrors are plain readonly data (primitives, `bigint` seeds, nested arrays and objects, no class
 * instances, no cycles), which is exactly the shape a structural walk handles safely.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // `null` is a domain value here (an unrecalled memory, an unnamed neuron); `typeof null` is
  // 'object', so it has to be settled before the object walk.
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // NaN never equals itself under ===, and a numeric field that is NaN in both reads is
    // unchanged as far as the scene is concerned.
    return typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => sameValue(item, b[index]))
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const keys = Object.keys(aRecord)
  if (keys.length !== Object.keys(bRecord).length) return false
  return keys.every((key) => key in bRecord && sameValue(aRecord[key], bRecord[key]))
}

/** Two domain records carry the same facts. */
export function sameFacts<T>(a: T, b: T): boolean {
  return sameValue(a, b)
}

/** Two collections carry the same records in the same order. */
export function sameRecords<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((item, index) => sameValue(item, b[index]))
}

/** Two reads describe the same universe — same facts, same order, same clock. */
export function sameUniverseSnapshot(a: UniverseSnapshot, b: UniverseSnapshot): boolean {
  return (
    a === b ||
    (a.universeTime === b.universeTime &&
      sameRecords(a.memories, b.memories) &&
      sameRecords(a.neurons, b.neurons) &&
      sameRecords(a.synapses, b.synapses))
  )
}
