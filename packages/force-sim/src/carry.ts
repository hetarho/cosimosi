import {
  FORCE_SIM_COORDINATE_STRIDE,
  forceSimCoordinateOffset,
  forceSimNodeKey,
  type ForceSimCoordinate,
  type ForceSimGraph,
  type ForceSimNodeIndex,
} from './graph.ts'

// Carry coordinates across a refetch by stable node IDENTITY (`kind:id`), never by array slot.
// The backend returns neurons ORDER BY random id, so a refetch (e.g. after a launch that minted a
// new random id) can reorder survivors: a node's array slot is not stable, only its id is. Keying
// by slot would hand a survivor's old position to whoever now sits in its slot. Keying by id keeps
// every position bound to its own node.

// A node's coordinate out of a buffer laid out by `index`, or null if that id wasn't in the
// buffer (a genuinely new node) or its slot falls outside the buffer.
function readByKey(buffer: Float32Array, index: ForceSimNodeIndex, key: string): ForceSimCoordinate | null {
  const slot = index.byKey[key]
  if (slot === undefined) return null
  const offset = forceSimCoordinateOffset(slot)
  if (offset + FORCE_SIM_COORDINATE_STRIDE > buffer.length) return null
  return { x: buffer[offset], y: buffer[offset + 1], z: buffer[offset + 2] }
}

// Enrich a freshly-built graph with the positions the previous frame ended on, feeding plan 19's
// `previousPosition` / `seedHint` seed seam so the next sim resumes each surviving node near where
// it was — the same continuity on the worker (web) and inline (mobile) branches. New nodes carry
// no hint and seed normally; removed nodes are simply absent.
export function carryPreviousPositions(
  graph: ForceSimGraph,
  previousBuffer: Float32Array,
  previousIndex: ForceSimNodeIndex,
): ForceSimGraph {
  const neurons = graph.neurons.map((neuron) => {
    const previous = readByKey(previousBuffer, previousIndex, forceSimNodeKey('neuron', neuron.id))
    return previous ? { ...neuron, previousPosition: previous } : neuron
  })
  const episodicMemories = graph.episodicMemories.map((memory) => {
    const previous = readByKey(previousBuffer, previousIndex, forceSimNodeKey('episodicMemory', memory.id))
    return previous ? { ...memory, seedHint: previous } : memory
  })
  return { ...graph, neurons, episodicMemories }
}

// Build the display buffer for the worker swap-over: while the new sim spins up, keep each
// SURVIVING node's last coordinate on screen at its NEW slot (looked up by id). Genuinely new
// slots stay at the origin until the first tick — the same brief, accepted flash as before — but
// no existing node is ever shown at another node's coordinate.
export function remapCoordinateBuffer(
  nextIndex: ForceSimNodeIndex,
  previousBuffer: Float32Array,
  previousIndex: ForceSimNodeIndex,
): Float32Array {
  const next = new Float32Array(nextIndex.entries.length * FORCE_SIM_COORDINATE_STRIDE)
  for (const entry of nextIndex.entries) {
    const previousSlot = previousIndex.byKey[forceSimNodeKey(entry.kind, entry.id)]
    if (previousSlot === undefined) continue
    const from = forceSimCoordinateOffset(previousSlot)
    if (from + FORCE_SIM_COORDINATE_STRIDE > previousBuffer.length) continue
    next.set(previousBuffer.subarray(from, from + FORCE_SIM_COORDINATE_STRIDE), entry.offset)
  }
  return next
}
