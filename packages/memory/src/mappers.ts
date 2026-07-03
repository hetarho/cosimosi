import { MOODS, type Emotion, type Mood } from '@cosimosi/emotion'
import type {
  EmotionDto,
  EpisodicMemoryDto,
  GetUniverseResponse,
  NeuronDto,
  SynapseDto,
} from '@cosimosi/api-client'

import type { EpisodicMemory } from './episodic-memory.ts'
import { isNeuronType, type Neuron } from './neuron.ts'
import type { Synapse } from './synapse.ts'

// proto → FE domain — the FE anti-corruption boundary (ARCHITECTURE §3.4), mirroring the
// backend's rpc mapper. Strict on invariants the server enforces at write time ([M1] moods,
// [E3] neuron types, canonical synapse order): a violation here means corrupt data, so the
// mappers fail loud instead of inventing domain facts. Stored values are carried verbatim —
// nothing is re-derived (read-time math belongs to @cosimosi/memory-logic).

function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value)
}

export function emotionFromDto(dto: EmotionDto): Emotion {
  if (!isMood(dto.mood)) {
    throw new Error(`unknown mood on the wire: ${dto.mood}`)
  }
  return {
    mood: dto.mood,
    valence: dto.valence,
    arousal: dto.arousal,
    intensity: dto.intensity,
  }
}

export function episodicMemoryFromDto(dto: EpisodicMemoryDto): EpisodicMemory {
  if (!dto.emotion) {
    throw new Error(`episodic memory ${dto.id} arrived without an emotion`)
  }
  return {
    id: dto.id,
    name: dto.name,
    emotion: emotionFromDto(dto.emotion),
    baseStrength: dto.baseStrength,
    recallCount: dto.recallCount,
    createdUniverseTime: dto.createdUniverseTime,
    lastRecalledUniverseTime: dto.lastRecalledUniverseTime ?? null,
    seed: dto.seed ?? null,
    activations: dto.activations.map((activation) => ({
      neuronId: activation.neuronId,
      weight: activation.weight,
    })),
  }
}

export function neuronFromDto(dto: NeuronDto): Neuron {
  if (!isNeuronType(dto.neuronType)) {
    throw new Error(`unknown neuron type on the wire: ${dto.neuronType} (neuron ${dto.id})`)
  }
  return {
    id: dto.id,
    name: dto.name ?? null,
    neuronType: dto.neuronType,
    connectivity: dto.connectivity,
  }
}

export function synapseFromDto(dto: SynapseDto): Synapse {
  if (!(dto.neuronAId < dto.neuronBId)) {
    throw new Error(`synapse ${dto.id} is not canonical (expected neuron_a_id < neuron_b_id)`)
  }
  return {
    id: dto.id,
    neuronAId: dto.neuronAId,
    neuronBId: dto.neuronBId,
    strength: dto.strength,
    coActivationCount: dto.coActivationCount,
    lastActivatedUniverseTime: dto.lastActivatedUniverseTime,
  }
}

// The whole per-user read model one GetUniverse fetch yields.
export interface UniverseSnapshot {
  readonly memories: readonly EpisodicMemory[]
  readonly neurons: readonly Neuron[]
  readonly synapses: readonly Synapse[]
  /** ISO DATE; null until the first launch sets universe time. */
  readonly universeTime: string | null
}

export function universeFromResponse(response: GetUniverseResponse): UniverseSnapshot {
  return {
    memories: response.memories.map(episodicMemoryFromDto),
    neurons: response.neurons.map(neuronFromDto),
    synapses: response.synapses.map(synapseFromDto),
    universeTime: response.universeTime === '' ? null : response.universeTime,
  }
}
