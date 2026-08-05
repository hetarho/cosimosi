import type { ForceSimGraph } from './graph.ts'

/**
 * Would two graphs produce the same layout from the same starting state?
 *
 * The sim is deterministic in its inputs, so this is decidable by inspection — and worth deciding,
 * because restarting it is not free: a restart terminates the worker, respawns it, reallocates both
 * ping-pong ArrayBuffers, and re-seeds the simulation. A refetch that changed nothing must not pay
 * that.
 *
 * Equivalence is **ordered**, not set-based. Node order is the coordinate buffer's slot layout, so
 * two graphs holding the same nodes in a different order are NOT equivalent here: they need the
 * remap-and-reseed path, which realigns coordinates by id. Answering "equivalent" for a reorder
 * would leave the running sim laying out the old slots while consumers index the new ones — every
 * node wearing another node's position.
 *
 * The walk is structural rather than a field-by-field comparison per node type, because every field
 * of every graph node feeds a force or a placement: a field added to `ForceSimGraph` and forgotten
 * here would make a real layout change read as equivalent — a frozen universe with no failing test.
 * A structural walk cannot forget. Graph nodes are plain data (numbers, string ids, `{x,y,z}`), the
 * shape a walk handles safely.
 */
export function sameForceSimGraph(a: ForceSimGraph, b: ForceSimGraph): boolean {
  return (
    a === b ||
    (sameSequence(a.neurons, b.neurons) &&
      sameSequence(a.episodicMemories, b.episodicMemories) &&
      sameSequence(a.synapses, b.synapses) &&
      sameSequence(a.activations, b.activations))
  )
}

function sameSequence(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    if (!sameValue(a[index], b[index])) return false
  }
  return true
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  // Optional hints (`previousPosition`, `seedHint`) may be absent on one side and present-undefined
  // on the other; both mean "no hint", so key sets are compared through the values.
  for (const key of new Set([...Object.keys(aRecord), ...Object.keys(bRecord)])) {
    if (!sameValue(aRecord[key], bRecord[key])) return false
  }
  return true
}
