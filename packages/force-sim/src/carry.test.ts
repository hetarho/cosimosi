import { describe, expect, it } from 'vitest'

import { carryPreviousPositions, remapCoordinateBuffer } from './carry.ts'
import { createForceSimNodeIndex, type ForceSimGraph } from './graph.ts'

const neuron = (id: string) => ({ id, connectivity: 1 })
const graphOf = (neuronIds: string[], memoryIds: string[] = []): ForceSimGraph => ({
  neurons: neuronIds.map(neuron),
  synapses: [],
  episodicMemories: memoryIds.map((id) => ({ id })),
  activations: [],
})

// Previous frame: neurons [A, B] at slots 0/1, memory [M] at slot 2.
const previousGraph = graphOf(['A', 'B'], ['M'])
const previousIndex = createForceSimNodeIndex(previousGraph)
const previousBuffer = Float32Array.from([1, 1, 1, 2, 2, 2, 3, 3, 3])

describe('remapCoordinateBuffer', () => {
  // The R001 regression: a new neuron whose random id sorts BEFORE the survivors takes slot 0,
  // so carrying by slot would hand A's coordinate to the newcomer. Carrying by id must not.
  it('keeps each surviving node coordinate at its NEW slot when a new node reorders the array', () => {
    const nextIndex = createForceSimNodeIndex(graphOf(['C', 'A', 'B'], ['M']))
    const remapped = remapCoordinateBuffer(nextIndex, previousBuffer, previousIndex)
    // C (new) → slot 0 stays origin; A → slot 1; B → slot 2; M → slot 3, all by id.
    expect(Array.from(remapped)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
  })

  it('drops a removed node and sizes the buffer to the new graph', () => {
    const nextIndex = createForceSimNodeIndex(graphOf(['A'], []))
    const remapped = remapCoordinateBuffer(nextIndex, previousBuffer, previousIndex)
    expect(Array.from(remapped)).toEqual([1, 1, 1])
  })
})

describe('carryPreviousPositions', () => {
  it('seeds survivors from their prior positions by id and leaves new nodes unseeded', () => {
    const next = carryPreviousPositions(
      graphOf(['C', 'A', 'B'], ['M']),
      previousBuffer,
      previousIndex,
    )
    const byId = Object.fromEntries(next.neurons.map((n) => [n.id, n.previousPosition]))
    expect(byId.A).toEqual({ x: 1, y: 1, z: 1 })
    expect(byId.B).toEqual({ x: 2, y: 2, z: 2 })
    expect(byId.C).toBeUndefined()
    expect(next.episodicMemories[0]).toEqual({ id: 'M', seedHint: { x: 3, y: 3, z: 3 } })
  })

  it('carries a survivor by id even when its array slot changed', () => {
    // Reorder [A, B] → [B, A]: A moved to slot 1 but must still get A's prior (1,1,1).
    const next = carryPreviousPositions(graphOf(['B', 'A']), previousBuffer, previousIndex)
    const byId = Object.fromEntries(next.neurons.map((n) => [n.id, n.previousPosition]))
    expect(byId.A).toEqual({ x: 1, y: 1, z: 1 })
    expect(byId.B).toEqual({ x: 2, y: 2, z: 2 })
  })
})
