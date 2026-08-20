import type { SplitDiaryResponse } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

// The in-session proposal shape (plain values): name / mood / source text / neuron membership —
// the schema carries nothing else, so there is structurally no position / color / strength / time
// to edit ([W4a][I3]). Structurally compatible with the feature api input types, so it feeds them
// directly.
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
  // The diary passage this memory was encoded from, in the writer's own words. Editable here
  // because it is the writer's own account ([W4]) — the fidelity rule that produced it binds the
  // extractor, not the person. It becomes the memory's current_text at launch ([R8a]).
  readonly sourceText: string
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
    sourceText: memory.sourceText,
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

export function setMemorySourceText(
  memories: readonly ProposedMemoryDraft[],
  index: number,
  sourceText: string,
): ProposedMemoryDraft[] {
  return memories.map((memory, position) =>
    position === index ? { ...memory, sourceText } : memory,
  )
}

// Merge memory `index` with the one after it: keep the first's name + mood, union the neuron
// membership (deduped) — a neuron-normalization edit expressed by touch ([W4][E10]).
export function mergeMemory(
  memories: readonly ProposedMemoryDraft[],
  index: number,
): ProposedMemoryDraft[] {
  // Never fall below what a launch accepts — the same floor the UI gate enforces, clamped here as
  // defense in depth so no caller can drive the proposal out of range ([E2]). The floor is the
  // accepted one, not the 2–5 target: a single-scene split is a legitimate day.
  if (memories.length <= VALUES.encode.minMemoriesAccepted) return memories.slice()
  const first = memories[index]
  const second = memories[index + 1]
  if (!first || !second) return memories.slice()
  const merged: ProposedMemoryDraft = {
    id: first.id,
    name: first.name,
    mood: first.mood,
    // The passages are consecutive slices of one diary, so joining them in order rebuilds the
    // writer's text exactly — no re-quoting, and nothing of theirs is lost to the merge.
    sourceText: joinPassages(first.sourceText, second.sourceText),
    neurons: dedupeNeurons([...first.neurons, ...second.neurons]),
  }
  return [...memories.slice(0, index), merged, ...memories.slice(index + 2)]
}

// Split memory `index` into two: neuron membership is halved so each side is a distinct memory the
// user (or a follow-up NL revise) refines, and the passage is cut with it. A single-neuron memory
// copies its neuron to both so neither side is left empty.
export function splitMemory(
  memories: readonly ProposedMemoryDraft[],
  index: number,
): ProposedMemoryDraft[] {
  // Never exceed the encode maximum — the same 2–5 bound the UI gate enforces, clamped here as
  // defense in depth so no caller can drive the proposal out of range ([E2]).
  if (memories.length >= VALUES.encode.maxMemories) return memories.slice()
  const target = memories[index]
  if (!target) return memories.slice()
  const mid = Math.max(1, Math.ceil(target.neurons.length / 2))
  const head = target.neurons.slice(0, mid)
  const tail = target.neurons.slice(mid)
  const [headText, tailText] = cutPassage(target.sourceText)
  // The first half keeps the target's id (its row stays put); the new second half gets a fresh id.
  const first: ProposedMemoryDraft = { ...target, sourceText: headText, neurons: head }
  const second: ProposedMemoryDraft = {
    ...target,
    id: nextMemoryId(),
    sourceText: tailText,
    neurons: tail.length > 0 ? tail : head.slice(0, 1),
  }
  return [...memories.slice(0, index), first, second, ...memories.slice(index + 1)]
}

function joinPassages(first: string, second: string): string {
  if (!first.trim()) return second
  if (!second.trim()) return first
  return `${first.trimEnd()} ${second.trimStart()}`
}

// Cut a passage at the sentence boundary nearest its middle, so both halves stay whole sentences of
// the writer's text — a substring of an already-verified passage, which is why a hand split needs
// no re-quoting and cannot drift from the diary. A single-sentence passage goes to both halves
// rather than being sliced mid-clause (the same choice splitMemory makes for a lone neuron): a
// blank passage cannot launch, and an NL revise re-cuts it properly.
function cutPassage(sourceText: string): [string, string] {
  const sentences = sourceText.split(/(?<=[.!?\u3002\u2026])\s+/).filter((part) => part !== '')
  if (sentences.length < 2) return [sourceText, sourceText]
  const mid = Math.round(sentences.length / 2)
  return [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')]
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
