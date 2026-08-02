import { arousalToInitialStrength, createEmotion, type Mood } from '@cosimosi/emotion'
import type {
  Diary,
  DiarySplitMember,
  EpisodicMemory,
  Neuron,
  Synapse,
  UniverseSnapshot,
} from '@cosimosi/memory'
import type { Locale } from '@cosimosi/i18n'

import type { DemoDiarySet } from './diary-set.ts'

// The gist strings the production mirror has no field for: gist text is a paid `ViewSemantic` read,
// so widening `EpisodicMemory` for the sandbox would be a demo flag in `packages/memory` under
// another name. It travels beside the snapshot instead.
export interface DemoGistTexts {
  readonly episodicMemoryId: string
  /** Stage 1..SEMANTIC_MAX_STAGE. */
  readonly stages: readonly string[]
}

// The reconsolidated readings, likewise beside the snapshot rather than on the mirror: a recall in
// the real product rewrites `currentText` through a use-case, so there is no second text field to
// widen `EpisodicMemory` with. Keyed by memory id; only a scenario's recall target has one.
export type DemoReconsolidatedTexts = Readonly<Record<string, string>>

export interface ResolvedDemoDiarySet {
  readonly snapshot: UniverseSnapshot
  readonly diaries: Diary[]
  readonly gistTexts: readonly DemoGistTexts[]
  readonly reconsolidatedTexts: DemoReconsolidatedTexts
}

// The newest fixture diary — tutorial triple or free-play extra — lands on the visitor's own today,
// so the demo never opens on a universe that is visibly years stale. Pure: `today` is a parameter,
// and this package reads no clock.
export function resolveDemoEpoch(today: string, set: DemoDiarySet): string {
  const span = Math.max(
    ...[...set.structure.diaries, ...set.structure.extraDiaries].map((diary) => diary.dayOffset),
  )
  return shiftIsoDate(today, -span)
}

// Turns a fixture into exactly what the real read path produces — the same `UniverseSnapshot`
// interface `universeFromResponse` returns and the same `Diary` shape `diariesFromDtos` returns —
// so `buildUniverseGraph`, the three read-model stores, the render channels, the forgetting family
// and the latent field all receive production input and no demo branch exists below the page [I13].
// Writing domain shapes straight in also skips the proto/DTO mappers, so no bigint↔int64 handling
// and no api-client type enters the sandbox.
export function resolveDemoDiarySet(
  set: DemoDiarySet,
  locale: Locale,
  epoch: string,
): ResolvedDemoDiarySet {
  const { structure } = set
  const text = set.text[locale]

  const degrees = new Map<string, number>()
  for (const synapse of structure.synapses) {
    degrees.set(synapse.neuronAId, (degrees.get(synapse.neuronAId) ?? 0) + 1)
    degrees.set(synapse.neuronBId, (degrees.get(synapse.neuronBId) ?? 0) + 1)
  }

  const neurons: Neuron[] = structure.neurons.map((neuron) => ({
    id: neuron.id,
    name: text.neuronNames[neuron.id] ?? null,
    neuronType: neuron.neuronType,
    // Derived at read time from the authored edges, never stored — the degree IS the layout radius
    // input [V1], and a stored copy would be a second fact to keep true (§2.9 #3).
    connectivity: degrees.get(neuron.id) ?? 0,
  }))

  const memories: EpisodicMemory[] = []
  const gistTexts: DemoGistTexts[] = []
  const reconsolidatedTexts: Record<string, string> = {}
  const diaries: Diary[] = []

  // Extras resolve exactly like the triple — one shape, one loop — so a free-play diary is
  // indistinguishable from a tutorial one everywhere below this function ([Z4][Z5]).
  for (const diary of [...structure.diaries, ...structure.extraDiaries]) {
    const diaryDate = shiftIsoDate(epoch, diary.dayOffset)
    const diaryText = text.diaries[diary.id]
    if (!diaryText)
      throw new Error(`demo fixture ${structure.id}: no ${locale} text for ${diary.id}`)

    const members: DiarySplitMember[] = []
    for (const memory of diary.memories) {
      const memoryText = diaryText.memories[memory.id]
      if (!memoryText)
        throw new Error(`demo fixture ${structure.id}: no ${locale} text for ${memory.id}`)

      memories.push({
        id: memory.id,
        name: memoryText.name,
        emotion: createEmotion(memory.mood, memory.intensity),
        baseStrength: demoBaseStrength(memory.mood),
        recallCount: 0,
        createdUniverseTime: diaryDate,
        lastRecalledUniverseTime: null,
        seed: memory.seed,
        activations: memory.activations,
        decayStages: memoryText.decayStages,
        forgettingOffsetDays: 0,
        currentText: memoryText.currentText,
        semanticStage: 0,
      })
      gistTexts.push({ episodicMemoryId: memory.id, stages: memoryText.semanticStages })
      if (memoryText.reconsolidatedText) {
        reconsolidatedTexts[memory.id] = memoryText.reconsolidatedText
      }
      members.push({ episodicMemoryId: memory.id, name: memoryText.name, mood: memory.mood })
    }

    diaries.push({
      id: diary.id,
      body: diaryText.body,
      diaryDate,
      createdUniverseTime: diaryDate,
      memories: members,
    })
  }

  const synapses: Synapse[] = structure.synapses.map((synapse) => ({
    id: synapse.id,
    neuronAId: synapse.neuronAId,
    neuronBId: synapse.neuronBId,
    strength: synapse.strength,
    coActivationCount: synapse.coActivationCount,
    lastActivatedUniverseTime: shiftIsoDate(epoch, synapse.lastActivatedDayOffset),
  }))

  return {
    snapshot: {
      memories,
      neurons,
      synapses,
      // The universe's time right after its last launch — the MAX date, not the last authored
      // one: a set whose diaries were authored out of offset order would otherwise open with a
      // universe time older than one of its own memories, and every decay quantity is a
      // difference from it.
      universeTime: diaries.reduce(
        (latest, diary) => (diary.diaryDate > latest ? diary.diaryDate : latest),
        diaries[0].diaryDate,
      ),
    },
    diaries,
    gistTexts,
    reconsolidatedTexts,
  }
}

// The fixture authors a mood and lets the real relationship produce the number, so the demo shows
// [I3] rather than a hand-tuned strength. It takes the mood alone because that is genuinely all the
// relationship reads — neither intensity nor valence enters. Exported because the integrity suite
// weighs a set's moods by the same quantity the universe's colour blend does.
export function demoBaseStrength(mood: Mood): number {
  return arousalToInitialStrength(createEmotion(mood).arousal)
}

// Calendar arithmetic on a date-only universe timestamp, the inverse of `elapsedUniverseDays`'
// difference. Parsed as UTC midnight so no timezone can move a diary a day; not domain math, and
// deliberately the only date function this package owns.
function shiftIsoDate(isoDate: string, days: number): string {
  const base = Date.parse(isoDate)
  if (Number.isNaN(base)) throw new Error(`demo fixture: ${isoDate} is not an ISO date`)
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10)
}
