import type { SplitDiaryResponse } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

// The in-session proposal shape (plain values): name / mood / neuron membership only — the schema
// carries nothing else, so there is structurally no position / color / strength / time to edit
// ([W4a][I3]). Structurally compatible with the feature api input types, so it feeds them directly.
export interface ProposedNeuronDraft {
  readonly name: string
  readonly type: string
}

export interface ProposedMemoryDraft {
  // Session-local identity for stable React keys across merge/split reordering. Never sent on the
  // wire (the api mappers pick name / mood / neurons only), so it adds no editable or visible field
  // — the surface stays name / emotion / membership ([W4a][I3]).
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly neurons: readonly ProposedNeuronDraft[]
}

// A plain monotonic counter — no crypto / Math.random — so this model stays portable to React
// Native and deterministic to test; uniqueness within a session is all a React key needs.
let memoryIdSeq = 0
function nextMemoryId(): string {
  memoryIdSeq += 1
  return `pm-${memoryIdSeq}`
}

// SplitDiary / ReviseSplit responses → the editable proposal. NL revises replace the whole proposal
// with this same shape, so a hand-edit and an NL edit converge on one representation.
export function draftsFromResponse(response: SplitDiaryResponse): ProposedMemoryDraft[] {
  return response.memories.map((memory) => ({
    id: nextMemoryId(),
    name: memory.name,
    mood: memory.mood,
    neurons: memory.neurons.map((neuron) => ({ name: neuron.name, type: neuron.type })),
  }))
}

export function renameMemory(
  memories: readonly ProposedMemoryDraft[],
  index: number,
  name: string,
): ProposedMemoryDraft[] {
  return memories.map((memory, position) => (position === index ? { ...memory, name } : memory))
}

export function setMemoryMood(
  memories: readonly ProposedMemoryDraft[],
  index: number,
  mood: string,
): ProposedMemoryDraft[] {
  return memories.map((memory, position) => (position === index ? { ...memory, mood } : memory))
}

// Merge memory `index` with the one after it: keep the first's name + mood, union the neuron
// membership (deduped) — a neuron-normalization edit expressed by touch ([W4][E10]).
export function mergeMemory(memories: readonly ProposedMemoryDraft[], index: number): ProposedMemoryDraft[] {
  // Never fall below the encode minimum — the same 2–5 bound the UI gate enforces, clamped here as
  // defense in depth so no caller can drive the proposal out of range ([E2]).
  if (memories.length <= VALUES.encode.minMemories) return memories.slice()
  const first = memories[index]
  const second = memories[index + 1]
  if (!first || !second) return memories.slice()
  const merged: ProposedMemoryDraft = {
    id: first.id,
    name: first.name,
    mood: first.mood,
    neurons: dedupeNeurons([...first.neurons, ...second.neurons]),
  }
  return [...memories.slice(0, index), merged, ...memories.slice(index + 2)]
}

// Split memory `index` into two: neuron membership is halved so each side is a distinct memory the
// user (or a follow-up NL revise) refines. A single-neuron memory copies its neuron to both so
// neither side is left empty.
export function splitMemory(memories: readonly ProposedMemoryDraft[], index: number): ProposedMemoryDraft[] {
  // Never exceed the encode maximum — the same 2–5 bound the UI gate enforces, clamped here as
  // defense in depth so no caller can drive the proposal out of range ([E2]).
  if (memories.length >= VALUES.encode.maxMemories) return memories.slice()
  const target = memories[index]
  if (!target) return memories.slice()
  const mid = Math.max(1, Math.ceil(target.neurons.length / 2))
  const head = target.neurons.slice(0, mid)
  const tail = target.neurons.slice(mid)
  // The first half keeps the target's id (its row stays put); the new second half gets a fresh id.
  const first: ProposedMemoryDraft = { ...target, neurons: head }
  const second: ProposedMemoryDraft = { ...target, id: nextMemoryId(), neurons: tail.length > 0 ? tail : head.slice(0, 1) }
  return [...memories.slice(0, index), first, second, ...memories.slice(index + 1)]
}

function dedupeNeurons(neurons: readonly ProposedNeuronDraft[]): ProposedNeuronDraft[] {
  const seen = new Set<string>()
  const result: ProposedNeuronDraft[] = []
  for (const neuron of neurons) {
    const key = `${neuron.type}:${neuron.name}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(neuron)
  }
  return result
}
