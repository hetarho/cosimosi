import { createEmotion, type Mood } from '@cosimosi/emotion'
import type { EpisodicMemory, Neuron, NeuronActivation, Synapse } from '@cosimosi/memory'

// A small self-contained universe for the /test surface: a handful of neurons, eight episodic
// memories anchored to them, and the synapses their co-activations imply. Positions live in a
// static coordinate buffer (the demo has no force-sim — the render layers read this buffer per
// frame exactly like production) so every engram-cell body draws with real domain facts:
// star size/brightness from strength, tint from mood, filaments over neuron↔neuron synapses.
// Deterministic: same scene every mount, so design work compares like-for-like.

type NeuronId = 'n-cat' | 'n-coffee' | 'n-kitchen' | 'n-mother' | 'n-rain' | 'n-sea'

interface NeuronSeed {
  readonly id: NeuronId
  readonly name: string
  readonly neuronType: Neuron['neuronType']
  readonly position: readonly [number, number, number]
}

// Neuron ids are pre-sorted lexicographically so synapse endpoints canonicalize by simple compare.
const NEURON_SEEDS: readonly NeuronSeed[] = [
  { id: 'n-cat', name: 'Byeol, the cat', neuronType: 'entity', position: [4, 3, 5] },
  { id: 'n-coffee', name: 'Coffee', neuronType: 'semantic', position: [3, -7, 2] },
  { id: 'n-kitchen', name: 'The kitchen', neuronType: 'spatial', position: [-3, 9, -3] },
  { id: 'n-mother', name: 'Mother', neuronType: 'entity', position: [-7, 5, 2] },
  { id: 'n-rain', name: 'Rain', neuronType: 'semantic', position: [8, -2, -2] },
  { id: 'n-sea', name: 'The winter sea', neuronType: 'spatial', position: [-10, -6, -4] },
]

interface MemorySeed {
  readonly id: string
  readonly name: string
  readonly mood: Mood
  readonly baseStrength: number
  readonly recallCount: number
  readonly createdUniverseTime: string
  readonly lastRecalledUniverseTime: string | null
  readonly seed: bigint
  readonly activations: readonly NeuronActivation[]
}

const MEMORY_SEEDS: readonly MemorySeed[] = [
  {
    id: 'm-window',
    name: 'A quiet afternoon by the window',
    mood: 'CALM',
    baseStrength: 0.74,
    recallCount: 3,
    createdUniverseTime: '2026-01-04',
    lastRecalledUniverseTime: '2026-01-24',
    seed: 10_007n,
    activations: [
      { neuronId: 'n-rain', weight: 0.6 },
      { neuronId: 'n-coffee', weight: 0.85 },
    ],
  },
  {
    id: 'm-dusk-kitchen',
    name: "Mother's kitchen at dusk",
    mood: 'LOVE',
    baseStrength: 0.9,
    recallCount: 5,
    createdUniverseTime: '2026-01-02',
    lastRecalledUniverseTime: '2026-01-26',
    seed: 20_011n,
    activations: [
      { neuronId: 'n-mother', weight: 0.95 },
      { neuronId: 'n-kitchen', weight: 0.7 },
    ],
  },
  {
    id: 'm-cat-home',
    name: 'The cat came home',
    mood: 'JOY',
    baseStrength: 0.66,
    recallCount: 2,
    createdUniverseTime: '2026-01-09',
    lastRecalledUniverseTime: '2026-01-20',
    seed: 30_013n,
    activations: [
      { neuronId: 'n-cat', weight: 0.9 },
      { neuronId: 'n-kitchen', weight: 0.5 },
    ],
  },
  {
    id: 'm-winter-sea',
    name: 'Waves at the winter sea',
    mood: 'SAD',
    baseStrength: 0.62,
    recallCount: 1,
    createdUniverseTime: '2026-01-11',
    lastRecalledUniverseTime: null,
    seed: 40_017n,
    activations: [{ neuronId: 'n-sea', weight: 1 }],
  },
  {
    id: 'm-cold-coffee',
    name: 'Coffee that went cold',
    mood: 'EMPTINESS',
    baseStrength: 0.55,
    recallCount: 0,
    createdUniverseTime: '2026-01-15',
    lastRecalledUniverseTime: null,
    seed: 50_021n,
    activations: [{ neuronId: 'n-coffee', weight: 0.8 }],
  },
  {
    id: 'm-laughing-rain',
    name: 'Laughing until it rained',
    mood: 'EXCITEMENT',
    baseStrength: 0.81,
    recallCount: 4,
    createdUniverseTime: '2026-01-06',
    lastRecalledUniverseTime: '2026-01-25',
    seed: 60_025n,
    activations: [
      { neuronId: 'n-rain', weight: 0.75 },
      { neuronId: 'n-cat', weight: 0.55 },
    ],
  },
  {
    id: 'm-unsent-letter',
    name: 'A letter I never sent',
    mood: 'TIRED',
    baseStrength: 0.6,
    recallCount: 1,
    createdUniverseTime: '2026-01-13',
    lastRecalledUniverseTime: null,
    seed: 70_027n,
    activations: [{ neuronId: 'n-mother', weight: 0.65 }],
  },
  {
    id: 'm-morning-light',
    name: 'Morning light, first cup',
    mood: 'GRATITUDE',
    baseStrength: 0.6,
    recallCount: 2,
    createdUniverseTime: '2026-01-08',
    lastRecalledUniverseTime: '2026-01-22',
    seed: 80_029n,
    activations: [
      { neuronId: 'n-coffee', weight: 0.7 },
      { neuronId: 'n-kitchen', weight: 0.6 },
    ],
  },
]

const UNIVERSE_TIME = '2026-01-28'
const TAU = Math.PI * 2
const MEMORY_RING_RADIUS = 16

export interface EngramDemoScene {
  readonly neurons: readonly Neuron[]
  readonly memories: readonly EpisodicMemory[]
  readonly synapses: readonly Synapse[]
  /** Interleaved xyz (stride 3): neurons first, then memories — the production buffer layout. */
  readonly positions: Float32Array
  /** Neuron id → coordinate-buffer slot, for the filament layer. */
  readonly neuronIndexById: Readonly<Record<string, number>>
  /** Memories occupy buffer slots [firstMemoryIndex, …) after the neurons. */
  readonly firstMemoryIndex: number
  readonly universeTime: string
}

export function buildEngramDemoScene(): EngramDemoScene {
  const positionById = new Map<NeuronId, readonly [number, number, number]>(
    NEURON_SEEDS.map((neuron) => [neuron.id, neuron.position]),
  )
  const neuronIndexById: Record<string, number> = {}
  NEURON_SEEDS.forEach((neuron, index) => {
    neuronIndexById[neuron.id] = index
  })

  const synapses = buildSynapses()
  const degreeById = new Map<NeuronId, number>()
  for (const synapse of synapses) {
    degreeById.set(synapse.neuronAId as NeuronId, (degreeById.get(synapse.neuronAId as NeuronId) ?? 0) + 1)
    degreeById.set(synapse.neuronBId as NeuronId, (degreeById.get(synapse.neuronBId as NeuronId) ?? 0) + 1)
  }

  const neurons: Neuron[] = NEURON_SEEDS.map((neuron) => ({
    id: neuron.id,
    name: neuron.name,
    neuronType: neuron.neuronType,
    connectivity: degreeById.get(neuron.id) ?? 0,
  }))

  const memories: EpisodicMemory[] = MEMORY_SEEDS.map((memory) => ({
    id: memory.id,
    name: memory.name,
    emotion: createEmotion(memory.mood),
    baseStrength: memory.baseStrength,
    recallCount: memory.recallCount,
    createdUniverseTime: memory.createdUniverseTime,
    lastRecalledUniverseTime: memory.lastRecalledUniverseTime,
    seed: memory.seed,
    activations: memory.activations,
  }))

  const positions = new Float32Array((neurons.length + memories.length) * 3)
  NEURON_SEEDS.forEach((neuron, index) => {
    positions[index * 3] = neuron.position[0]
    positions[index * 3 + 1] = neuron.position[1]
    positions[index * 3 + 2] = neuron.position[2]
  })

  const firstMemoryIndex = neurons.length
  MEMORY_SEEDS.forEach((memory, i) => {
    // Push each memory out to a visible ring, then lean it toward its neurons' centroid so the
    // filament + nebula read coherently against the anchoring engram cells.
    const centroid = centroidOf(memory.activations, positionById)
    const angle = (i / MEMORY_SEEDS.length) * TAU + 0.4
    const ring = MEMORY_RING_RADIUS + (i % 3) * 2.5
    const offset = (firstMemoryIndex + i) * 3
    positions[offset] = Math.cos(angle) * ring * 0.75 + centroid[0] * 0.5
    positions[offset + 1] = Math.sin(angle) * ring * 0.75 + centroid[1] * 0.5
    positions[offset + 2] = centroid[2] * 0.6 + ((i % 4) - 1.5) * 2.2
  })

  return { neurons, memories, synapses, positions, neuronIndexById, firstMemoryIndex, universeTime: UNIVERSE_TIME }
}

function centroidOf(
  activations: readonly NeuronActivation[],
  positionById: Map<NeuronId, readonly [number, number, number]>,
): readonly [number, number, number] {
  if (activations.length === 0) return [0, 0, 0]
  let x = 0
  let y = 0
  let z = 0
  for (const activation of activations) {
    const position = positionById.get(activation.neuronId as NeuronId) ?? [0, 0, 0]
    x += position[0]
    y += position[1]
    z += position[2]
  }
  return [x / activations.length, y / activations.length, z / activations.length]
}

// Neuron↔neuron links the co-activations imply (canonical neuronAId < neuronBId). Hand-listed so
// the strengths visibly vary across the filament layer.
function buildSynapses(): readonly Synapse[] {
  const pairs: readonly { a: NeuronId; b: NeuronId; strength: number; coActivationCount: number }[] = [
    { a: 'n-rain', b: 'n-coffee', strength: 0.7, coActivationCount: 4 },
    { a: 'n-mother', b: 'n-kitchen', strength: 0.88, coActivationCount: 6 },
    { a: 'n-cat', b: 'n-kitchen', strength: 0.55, coActivationCount: 3 },
    { a: 'n-rain', b: 'n-cat', strength: 0.48, coActivationCount: 2 },
    { a: 'n-coffee', b: 'n-kitchen', strength: 0.6, coActivationCount: 3 },
  ]
  return pairs.map((pair, index) => {
    const [neuronAId, neuronBId] = pair.a < pair.b ? [pair.a, pair.b] : [pair.b, pair.a]
    return {
      id: `s-${index}`,
      neuronAId,
      neuronBId,
      strength: pair.strength,
      coActivationCount: pair.coActivationCount,
      lastActivatedUniverseTime: UNIVERSE_TIME,
    }
  })
}
