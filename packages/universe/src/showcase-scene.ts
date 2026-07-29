import { MOODS, createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory, Synapse } from '@cosimosi/memory'

import { buildContributors, type NebulaContributors } from './contributors.ts'
import { gistStarInstances } from './gist-star-channels.ts'
import { generateLatentField, type LatentField } from './latent-field.ts'
import { projectFilaments, type FilamentBatch } from './filament-channels.ts'

// The scenes the design showcase reads a body against, shared by web and mobile so a difference
// between the two surfaces is a real parity finding rather than two authors' idea of the same
// specimen. Every scene is built from the SAME projections production uses (starChannels,
// projectFilaments, gistStarInstances, buildContributors) over fixture domain facts — a body is
// reviewed through its real channel path or the review is of something else. Pure data: nothing
// here is persisted, read from the server, or written back to a store.
//
// A bench magnifies. Production sizes are tuned for a universe seen from its own distance, and a
// specimen is read at arm's length, so the magnifications below are declared per scene rather than
// hidden inside a panel's camera.

/** The present every fixture is dated against — a specimen has to be reproducible. */
export const SHOWCASE_UNIVERSE_TIME = '2026-01-28'

/** Days since the last recall, recent → long closed. The forgetting row's whole variable. */
export const SHOWCASE_ELAPSED_DAYS = [0, 20, 60, 150, 400] as const

const FORGETTING_MOOD = 'CALM' as const
const FORGETTING_STRENGTH = 0.7
/** One seed across the row: the form is identity, and identity does not fade. */
const FORGETTING_SEED = 991_027n
const ROW_SPACING = 9

export interface ForgettingShowcaseScene {
  readonly memories: readonly EpisodicMemory[]
  readonly positions: Float32Array
}

/** Wind a universe date back by `days` from the showcase present. */
function dayBefore(days: number): string {
  const [year, month, day] = SHOWCASE_UNIVERSE_TIME.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day) - days * 86_400_000).toISOString().slice(0, 10)
}

function fixtureMemory(overrides: Partial<EpisodicMemory> & { id: string }): EpisodicMemory {
  return {
    name: overrides.id,
    emotion: createEmotion('NEUTRAL'),
    baseStrength: 0.6,
    recallCount: 0,
    createdUniverseTime: SHOWCASE_UNIVERSE_TIME,
    lastRecalledUniverseTime: null,
    seed: null,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: overrides.id,
    semanticStage: 0,
    ...overrides,
  }
}

/**
 * One memory at five ages, in a row. Mood, strength and seed are held identical so the only
 * variable is how long it has been since the memory was returned to — forgetting can only be read
 * as a difference between neighbours.
 */
export function forgettingShowcaseScene(): ForgettingShowcaseScene {
  const positions = new Float32Array(SHOWCASE_ELAPSED_DAYS.length * 3)
  const memories = SHOWCASE_ELAPSED_DAYS.map((days, i) => {
    positions[i * 3] = (i - (SHOWCASE_ELAPSED_DAYS.length - 1) / 2) * ROW_SPACING
    const recalled = dayBefore(days)
    return fixtureMemory({
      id: `forgetting-${days}`,
      name: String(days),
      emotion: createEmotion(FORGETTING_MOOD),
      baseStrength: FORGETTING_STRENGTH,
      createdUniverseTime: recalled,
      lastRecalledUniverseTime: recalled,
      seed: FORGETTING_SEED,
      currentText: FORGETTING_MOOD,
    })
  })
  return { memories, positions }
}

/**
 * A body bench: several instances at ONE mood and ONE strength, differing only by seed. Form is the
 * variable, so brightness and colour are held still — the forgetting row would vary both.
 */
export function starFormsShowcaseScene(): ForgettingShowcaseScene {
  const seeds = [311n, 90_211n, 5_517n, 771_003n, 42n]
  const positions = new Float32Array(seeds.length * 3)
  const memories = seeds.map((seed, i) => {
    positions[i * 3] = (i - (seeds.length - 1) / 2) * ROW_SPACING
    return fixtureMemory({
      id: `star-form-${i}`,
      emotion: createEmotion(FORGETTING_MOOD),
      baseStrength: FORGETTING_STRENGTH,
      createdUniverseTime: SHOWCASE_UNIVERSE_TIME,
      lastRecalledUniverseTime: SHOWCASE_UNIVERSE_TIME,
      seed,
      currentText: FORGETTING_MOOD,
    })
  })
  return { memories, positions }
}

export interface MoodRingShowcaseScene {
  readonly positions: Float32Array
  readonly contributors: NebulaContributors
}

/**
 * One memory per mood on three rings, strengths spread across the range so bleed radius visibly
 * varies. The field is driven through the real contributor path, so blend, bleed and the emergent
 * tone are verifiable by eye without live domain data.
 */
export function moodRingShowcaseScene(): MoodRingShowcaseScene {
  const positions = new Float32Array(MOODS.length * 3)
  const memories = MOODS.map((mood, i) => {
    const angle = (i / MOODS.length) * Math.PI * 2
    const ring = 8 + (i % 3) * 4
    positions[i * 3] = Math.cos(angle) * ring
    positions[i * 3 + 1] = Math.sin(angle) * ring
    positions[i * 3 + 2] = ((i % 5) - 2) * 2
    return fixtureMemory({
      id: `mood-${mood}`,
      name: mood,
      emotion: createEmotion(mood),
      baseStrength: 0.35 + (i % 5) * 0.1,
      createdUniverseTime: '2026-01-01',
      currentText: mood,
    })
  })
  return { positions, contributors: buildContributors(memories, { firstNodeIndex: 0 }) }
}

/**
 * The three ambient bodies a universe is mostly made of, in one frame: neurons, the synapses
 * between them, and the latent dust behind. They are reviewed together because each is defined
 * against the others — a neuron reads as a body only next to the dust that is not one yet.
 */
export interface AmbientShowcaseScene {
  /** Neuron coordinates (interleaved xyz) — also the slots the filament endpoints name. */
  readonly positions: Float32Array
  readonly neuronCount: number
  readonly filaments: FilamentBatch
  readonly latent: LatentField
}

/** Three neurons in a triangle, wide enough that a strand's length reads before its width does. */
const AMBIENT_NEURONS: readonly (readonly [number, number, number])[] = [
  [-8, 3.5, 0],
  [0, -4.5, 1.5],
  [8, 3.5, -1.5],
]

/** Strengths chosen far apart: the specimen's question is whether width reads as strength. */
const AMBIENT_SYNAPSES: readonly {
  readonly a: number
  readonly b: number
  readonly strength: number
}[] = [
  { a: 0, b: 1, strength: 0.95 },
  { a: 1, b: 2, strength: 0.45 },
  { a: 0, b: 2, strength: 0.12 },
]

export function ambientShowcaseScene(): AmbientShowcaseScene {
  const positions = new Float32Array(AMBIENT_NEURONS.length * 3)
  const neuronIndexById: Record<string, number> = {}
  AMBIENT_NEURONS.forEach(([x, y, z], i) => {
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    neuronIndexById[`neuron-${i}`] = i
  })
  const synapses: Synapse[] = AMBIENT_SYNAPSES.map(({ a, b, strength }) => ({
    id: `synapse-${a}-${b}`,
    neuronAId: `neuron-${a}`,
    neuronBId: `neuron-${b}`,
    strength,
    coActivationCount: 1,
    lastActivatedUniverseTime: SHOWCASE_UNIVERSE_TIME,
  }))
  return {
    positions,
    neuronCount: AMBIENT_NEURONS.length,
    filaments: projectFilaments(synapses, neuronIndexById, SHOWCASE_UNIVERSE_TIME),
    // A shallow slab rather than the universe's full band: the dust has to read as depth behind
    // the neurons, not as a sky of its own.
    latent: generateLatentField({ seed: 4_120_711, count: 260, zMin: -14, zMax: -4, radius: 26 }),
  }
}

/**
 * The gist pair: the same memory as it is remembered and as it has been abstracted. The left column
 * is episodic only; the right has risen, so its gist bodies sit above their own original. Height is
 * the whole statement — the original is not dimmed to make room for it.
 */
export interface GistShowcaseScene {
  readonly memories: readonly EpisodicMemory[]
  /** Episodic coordinates for both columns (interleaved xyz). */
  readonly positions: Float32Array
  /** Gist body coordinates: its memory's x, y with the stage's own neocortical z. */
  readonly gistPositions: Float32Array
  readonly gistTints: Float32Array
  readonly gistSoftness: Float32Array
  readonly gistScales: Float32Array
  readonly gistCount: number
}

const GIST_COLUMN_X = 7
const GIST_MOOD = 'GRATITUDE' as const
/** How far the pair has climbed the ladder — two stages read as a ladder, one as an accident. */
const GIST_RISEN_STAGE = 2

export function gistShowcaseScene(): GistShowcaseScene {
  const memories = [
    fixtureMemory({
      id: 'gist-episodic',
      emotion: createEmotion(GIST_MOOD),
      baseStrength: 0.8,
      semanticStage: 0,
    }),
    fixtureMemory({
      id: 'gist-risen',
      emotion: createEmotion(GIST_MOOD),
      baseStrength: 0.8,
      semanticStage: GIST_RISEN_STAGE,
    }),
  ]
  const positions = new Float32Array(memories.length * 3)
  positions[0] = -GIST_COLUMN_X
  positions[3] = GIST_COLUMN_X
  const instances = gistStarInstances(memories)
  const gistPositions = new Float32Array(instances.length * 3)
  const gistTints = new Float32Array(instances.length * 3)
  const gistSoftness = new Float32Array(instances.length)
  const gistScales = new Float32Array(instances.length)
  instances.forEach((instance, i) => {
    const slot = memories.findIndex((memory) => memory.id === instance.memoryId)
    gistPositions[i * 3] = positions[slot * 3] ?? 0
    gistPositions[i * 3 + 1] = positions[slot * 3 + 1] ?? 0
    gistPositions[i * 3 + 2] = instance.z
    gistTints[i * 3] = instance.color[0]
    gistTints[i * 3 + 1] = instance.color[1]
    gistTints[i * 3 + 2] = instance.color[2]
    gistSoftness[i] = instance.softness
    gistScales[i] = instance.size
  })
  return {
    memories,
    positions,
    gistPositions,
    gistTints,
    gistSoftness,
    gistScales,
    gistCount: instances.length,
  }
}

/**
 * The latent field the awaken specimen flares into. Small and close: the flare is a single point
 * handing off to a neuron, and a wide field would leave the reviewer hunting for it.
 */
export function awakenShowcaseField(): LatentField {
  return generateLatentField({ seed: 7_260_119, count: 120, zMin: -3, zMax: 3, radius: 12 })
}
