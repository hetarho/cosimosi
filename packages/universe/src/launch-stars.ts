import { createMemoryClient, type ApiTransport, type LaunchStarsResponse } from '@cosimosi/api-client'
import { MOODS, arousalToInitialStrength, createEmotion, type Mood } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'

// The confirmed split as plain values (the editable surface: name / mood / neuron membership only).
export interface ConfirmedMemoryInput {
  readonly name: string
  readonly mood: string
  readonly neurons: readonly { readonly name: string; readonly type: string }[]
}

export interface LaunchStarsInput {
  readonly body: string
  readonly diaryDate: string
  /** The user-confirmed split ([W2][W4]). */
  readonly memories: readonly ConfirmedMemoryInput[]
}

// features/launch-stars api: LaunchStars persists the diary + memories atomically and returns ids
// only (§2.7 unary). Embeddings / neurons / synapses / the emergent position fill on the next
// GetUniverse read (§2.8) — this call never carries them. Fresh request objects are shaped here so
// the proto DTO boundary owns the wire shape.
export async function requestLaunchStars(transport: ApiTransport, input: LaunchStarsInput): Promise<LaunchStarsResponse> {
  return createMemoryClient(transport).launchStars({
    body: input.body,
    diaryDate: input.diaryDate,
    memories: input.memories.map((memory) => ({
      name: memory.name,
      mood: memory.mood,
      neurons: memory.neurons.map((neuron) => ({ name: neuron.name, type: neuron.type })),
    })),
  })
}

// A past-dated diary (before the universe's present) saves the diary but adds no memory ([T1][I10]).
// A null universe time is an empty universe — the first launch sets the clock, so nothing is past yet.
export function isPastDated(diaryDate: string, universeTime: string | null): boolean {
  return universeTime !== null && diaryDate < universeTime
}

// Optimistic insert (§2.8): append the confirmed memories with the server's returned ids so the
// body renders immediately — at the universe origin until the emergent position, deduped neurons,
// synapses, and embeddings fill on the next GetUniverse read. Only the memory itself is inserted;
// no neuron ids or synapses (server-decided). A failed launch never reaches here (the flow machine
// returns to reviewing before any insert), so nothing lingers to roll back. One memory per returned
// id — a past-dated diary returns no ids, so no body appears ([T1][I10]).
export function insertLaunchedMemories(
  memories: readonly ConfirmedMemoryInput[],
  memoryIds: readonly string[],
  diaryDate: string,
): void {
  const inserted: EpisodicMemory[] = []
  memoryIds.forEach((id, index) => {
    const memory = memories[index]
    if (memory) inserted.push(optimisticMemory(memory, id, diaryDate))
  })
  if (inserted.length === 0) return
  const store = useEpisodicMemoryStore.getState()
  const existing = store.ids
    .map((id) => store.byId[id])
    .filter((memory): memory is EpisodicMemory => Boolean(memory))
  store.setAll([...existing, ...inserted])
}

function optimisticMemory(memory: ConfirmedMemoryInput, id: string, diaryDate: string): EpisodicMemory {
  const emotion = createEmotion(asMood(memory.mood))
  return {
    id,
    name: memory.name,
    emotion,
    // A plausible size until the server's real base strength arrives on the next read.
    baseStrength: arousalToInitialStrength(emotion.arousal),
    recallCount: 0,
    createdUniverseTime: diaryDate,
    lastRecalledUniverseTime: null,
    seed: null,
    activations: [],
  }
}

function asMood(mood: string): Mood {
  return (MOODS as readonly string[]).includes(mood) ? (mood as Mood) : 'NEUTRAL'
}
