import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { createEmotion, type Mood } from '@cosimosi/emotion'
import { NEURON_TYPES } from '@cosimosi/memory'
import {
  SEMANTIC_MAX_STAGE,
  decayStage,
  decayStageText,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'

import type { DemoDiary, DemoDiarySet } from './diary-set.ts'
import { DEMO_DIARY_SETS } from './diary-sets/index.ts'
import { demoDiaryPool, pickDemoDiary, pickDemoDiarySet } from './pick.ts'
import { DEMO_BEAT_IDS } from './scenario.ts'
import { demoBaseStrength, resolveDemoDiarySet, resolveDemoEpoch } from './resolve.ts'

// Fixture INTEGRITY, not golden parity: shipped data cannot drift, but it can be edited into a state
// where the demo silently stops demonstrating what it promises — a set with no shared neuron shows
// three unrelated clumps instead of one cluster, and a recall target on the dominant mood makes
// beat 8's colour shift invisible. Those are the failures a gate has to catch, because the only
// other way to notice them is to sit and watch the demo.

const LOCALES = ['en', 'ko'] as const
const DECAY_STAGE_COUNT = VALUES.forgetting.stageWordRemovalRatios.length
const EPOCH = '2026-01-01'

interface MemberRef {
  readonly diaryId: string
  readonly memoryId: string
  readonly mood: Mood
  readonly neuronIds: readonly string[]
}

function membersOf(diaries: readonly DemoDiary[]): MemberRef[] {
  return diaries.flatMap((diary) =>
    diary.memories.map((memory) => ({
      diaryId: diary.id,
      memoryId: memory.id,
      mood: memory.mood,
      neuronIds: memory.activations.map((activation) => activation.neuronId),
    })),
  )
}

/** Tutorial triple + free-play extras — the whole authored pool. */
function members(set: DemoDiarySet): MemberRef[] {
  return membersOf([...set.structure.diaries, ...set.structure.extraDiaries])
}

function diariesPerNeuron(diaries: readonly DemoDiary[]): Map<string, Set<string>> {
  const spread = new Map<string, Set<string>>()
  for (const member of membersOf(diaries)) {
    for (const neuronId of member.neuronIds) {
      const seen = spread.get(neuronId) ?? new Set<string>()
      seen.add(member.diaryId)
      spread.set(neuronId, seen)
    }
  }
  return spread
}

describe.each(DEMO_DIARY_SETS.map((set) => [set.structure.id, set] as const))(
  'demo fixture set %s',
  (_id, set) => {
    const { structure } = set
    const neuronIds = new Set(structure.neurons.map((neuron) => neuron.id))
    const memoryIds = new Set(members(set).map((member) => member.memoryId))

    it('ships three tutorial diaries and a free-play pool, every activation naming a declared neuron', () => {
      expect(structure.diaries).toHaveLength(3)
      // The pool must outlast the tutorial: the run launches two diaries before free play begins,
      // so the extras are what a visitor who stays keeps drawing from ([Z4] as amended).
      expect(structure.extraDiaries.length).toBeGreaterThanOrEqual(3)
      for (const member of members(set)) {
        expect(member.neuronIds.length).toBeGreaterThan(0)
        for (const neuronId of member.neuronIds) expect(neuronIds.has(neuronId)).toBe(true)
      }
    })

    it.each(LOCALES)('carries a complete precomputed split in %s', (locale) => {
      const text = set.text[locale]
      for (const neuronId of neuronIds) expect(text.neuronNames[neuronId]).toBeTruthy()
      for (const diary of [...structure.diaries, ...structure.extraDiaries]) {
        const diaryText = text.diaries[diary.id]
        expect(diaryText?.body).toBeTruthy()
        for (const memory of diary.memories) {
          const memoryText = diaryText.memories[memory.id]
          expect(memoryText?.name).toBeTruthy()
          expect(memoryText.currentText).toBeTruthy()
          // The two ladders are as long as the domain says they are, so an edit that drops a rung
          // cannot leave a stage rendering an empty string.
          expect(memoryText.semanticStages).toHaveLength(SEMANTIC_MAX_STAGE)
          expect(memoryText.decayStages).toHaveLength(DECAY_STAGE_COUNT)
          for (const stageText of [...memoryText.semanticStages, ...memoryText.decayStages])
            expect(stageText.trim()).not.toBe('')
        }
      }
    })

    it('reuses at least one neuron across two or more diaries', () => {
      // Proven over the TUTORIAL triple, because the neuron-reuse beat happens before any extra
      // can have launched — an overlap that only an extra supplies would arrive too late.
      const spread = diariesPerNeuron(structure.diaries)
      const crossing = [...spread.values()].filter((diaryIds) => diaryIds.size >= 2)
      expect(crossing.length).toBeGreaterThan(0)
      // The declaration is not taken on trust — beat 4 rests on it.
      for (const sharedId of structure.sharedNeuronIds) {
        expect(spread.get(sharedId)?.size ?? 0).toBeGreaterThanOrEqual(2)
      }
    })

    it('keeps every free-play diary attached to the cluster it joins', () => {
      // An extra that activates only fresh neurons would settle as an unrelated clump; each one
      // must reuse at least one neuron the tutorial triple already lit ([I4][L2]).
      const tutorialNeurons = new Set(membersOf(structure.diaries).flatMap((m) => m.neuronIds))
      for (const extra of structure.extraDiaries) {
        const reused = membersOf([extra]).some((member) =>
          member.neuronIds.some((neuronId) => tutorialNeurons.has(neuronId)),
        )
        expect(reused).toBe(true)
      }
    })

    it('links only neurons that co-fire, canonically ordered and inside the production band', () => {
      const coFiring = new Set(
        members(set).flatMap((member) =>
          member.neuronIds.flatMap((a) =>
            member.neuronIds.filter((b) => a < b).map((b) => `${a}|${b}`),
          ),
        ),
      )
      const seen = new Set<string>()
      for (const synapse of structure.synapses) {
        expect(synapse.neuronAId < synapse.neuronBId).toBe(true)
        const pair = `${synapse.neuronAId}|${synapse.neuronBId}`
        expect(seen.has(pair)).toBe(false)
        seen.add(pair)
        expect(coFiring.has(pair)).toBe(true)
        expect(synapse.strength).toBeGreaterThanOrEqual(VALUES.synapse.initialSameMemory)
        expect(synapse.strength).toBeLessThanOrEqual(VALUES.synapse.strengthCap)
        expect(synapse.coActivationCount).toBeGreaterThan(0)
      }
    })

    it('exercises all three neuron types', () => {
      const types = new Set(structure.neurons.map((neuron) => neuron.neuronType))
      for (const type of NEURON_TYPES) expect(types.has(type)).toBe(true)
    })

    it('recalls an on-screen memory whose mood is not the dominant one', () => {
      // Weighed over the first two diaries — exactly what has launched when the recall and colour
      // beats arrive (beat 4 writes ONE more diary through the flow, not two).
      const onScreen = structure.diaries.slice(0, 2)
      const weights = new Map<string, number>()
      for (const diary of onScreen) {
        for (const memory of diary.memories) {
          weights.set(memory.mood, (weights.get(memory.mood) ?? 0) + demoBaseStrength(memory.mood))
        }
      }
      expect(weights.size).toBeGreaterThanOrEqual(3)

      const dominant = [...weights.entries()].reduce((best, entry) =>
        entry[1] > best[1] ? entry : best,
      )[0]
      const target = membersOf(onScreen).find(
        (member) => member.memoryId === set.scenario.recallMemoryId,
      )
      // The recall beat can only point at a memory that has launched by then.
      expect(target).toBeDefined()
      // Otherwise beat 8 ramps the sky to the colour it already had.
      expect(target?.mood).not.toBe(dominant)
    })

    it('spreads the diaries far enough apart to forget at different stages', () => {
      const { snapshot } = resolveDemoDiarySet(set, 'en', EPOCH)
      const stages = new Set(
        snapshot.memories.map((memory) =>
          decayStage(
            effectiveElapsedDays(
              snapshot.universeTime,
              memory.lastRecalledUniverseTime,
              memory.createdUniverseTime,
              memory.forgettingOffsetDays,
            ),
            memory.emotion.arousal,
            effectiveStrength(memory.baseStrength, memory.recallCount),
          ),
        ),
      )
      // Word loss has to read as a gradient across the set, not as one switch flipping.
      expect(stages.size).toBeGreaterThanOrEqual(2)
    })

    it('binds every beat to a member that exists, and nothing priced', () => {
      expect(set.scenario.beats).toEqual(DEMO_BEAT_IDS)
      // Beat 1 shows the pool's first draw, so the scenario's opening diary must BE that draw —
      // otherwise the tutorial and the draw cursor would disagree about what is on screen.
      expect(set.scenario.firstDiaryId).toBe(demoDiaryPool(set)[0].id)
      expect(memoryIds.has(set.scenario.recallMemoryId)).toBe(true)
      for (const locale of LOCALES) {
        // The recall beat swaps the text, so the target must have something to swap to in every
        // locale — an absence here would show a recall that changed only the memory's form.
        const { reconsolidatedTexts } = resolveDemoDiarySet(set, locale, EPOCH)
        expect(reconsolidatedTexts[set.scenario.recallMemoryId]).toBeTruthy()
      }
    })

    it.each(LOCALES)('erodes by the production word-loss function in %s', (locale) => {
      // The stored word-loss ladders ARE `decayStageText` outputs (produced at authoring time with
      // the memory's own seed, per plan 77's reuse rule). Byte equality is the guard: a hand-edited
      // stage would be a second erosion rule wearing a fixture's clothes ([Z5][Z6]).
      const text = set.text[locale]
      for (const diary of [...structure.diaries, ...structure.extraDiaries]) {
        for (const memory of diary.memories) {
          const memoryText = text.diaries[diary.id].memories[memory.id]
          memoryText.decayStages.forEach((stageText, index) => {
            expect(stageText).toBe(decayStageText(memoryText.currentText, index + 1, memory.seed))
          })
        }
      }
    })
  },
)

describe('demo resolution', () => {
  it('stamps every date from the epoch parameter and nothing else', () => {
    const set = DEMO_DIARY_SETS[0]
    const early = resolveDemoDiarySet(set, 'en', '2026-01-01')
    const late = resolveDemoDiarySet(set, 'en', '2029-06-15')

    expect(early.diaries[0].diaryDate).toBe('2026-01-01')
    expect(late.diaries[0].diaryDate).toBe('2029-06-15')
    // Only the calendar moves: every domain fact the render layers read is byte-identical [Z5].
    expect(late.snapshot.memories.map((memory) => memory.baseStrength)).toEqual(
      early.snapshot.memories.map((memory) => memory.baseStrength),
    )
    expect(late.snapshot.memories.map((memory) => memory.currentText)).toEqual(
      early.snapshot.memories.map((memory) => memory.currentText),
    )
    expect(late.gistTexts).toEqual(early.gistTexts)
  })

  it('hands back the production mirror shape, no wider and no narrower', () => {
    // The demo's whole isolation argument is that nothing below the page knows it exists. If a field
    // were ever added here to carry a demo-only value — a gist string, a coordinate, an isDemo flag —
    // the shared mirror would have grown for the sandbox's benefit, and this is where that shows up.
    const { snapshot, diaries } = resolveDemoDiarySet(DEMO_DIARY_SETS[0], 'en', EPOCH)
    expect(Object.keys(snapshot).sort()).toEqual([
      'memories',
      'neurons',
      'synapses',
      'universeTime',
    ])
    for (const memory of snapshot.memories) {
      expect(Object.keys(memory).sort()).toEqual([
        'activations',
        'baseStrength',
        'createdUniverseTime',
        'currentText',
        'decayStages',
        'diaryId',
        'emotion',
        'forgettingOffsetDays',
        'id',
        'lastRecalledUniverseTime',
        'name',
        'recallCount',
        'seed',
        'semanticStage',
      ])
    }
    for (const neuron of snapshot.neurons)
      expect(Object.keys(neuron).sort()).toEqual(['connectivity', 'id', 'name', 'neuronType'])
    for (const synapse of snapshot.synapses)
      expect(Object.keys(synapse).sort()).toEqual([
        'coActivationCount',
        'id',
        'lastActivatedUniverseTime',
        'neuronAId',
        'neuronBId',
        'strength',
      ])
    for (const diary of diaries)
      expect(Object.keys(diary).sort()).toEqual([
        'body',
        'createdUniverseTime',
        'diaryDate',
        'id',
        'memories',
      ])
  })

  it('opens on the newest diary date even out of authored order', () => {
    for (const set of DEMO_DIARY_SETS) {
      const { snapshot, diaries } = resolveDemoDiarySet(set, 'en', EPOCH)
      const newest = diaries.map((diary) => diary.diaryDate).sort()[diaries.length - 1]
      expect(snapshot.universeTime).toBe(newest)
    }
  })

  it('is deterministic and locale-complete', () => {
    for (const set of DEMO_DIARY_SETS) {
      for (const locale of LOCALES) {
        expect(resolveDemoDiarySet(set, locale, EPOCH)).toEqual(
          resolveDemoDiarySet(set, locale, EPOCH),
        )
      }
    }
  })

  it('derives connectivity from the authored edges and strength from arousal alone', () => {
    const set = DEMO_DIARY_SETS[0]
    const { snapshot } = resolveDemoDiarySet(set, 'en', EPOCH)
    for (const neuron of snapshot.neurons) {
      const degree = set.structure.synapses.filter(
        (synapse) => synapse.neuronAId === neuron.id || synapse.neuronBId === neuron.id,
      ).length
      expect(neuron.connectivity).toBe(degree)
    }
    for (const memory of snapshot.memories) {
      expect(memory.baseStrength).toBe(demoBaseStrength(memory.emotion.mood))
      expect(createEmotion(memory.emotion.mood, memory.emotion.intensity)).toEqual(memory.emotion)
    }
  })

  it('lands the newest diary on the given today', () => {
    const set = DEMO_DIARY_SETS[0]
    const epoch = resolveDemoEpoch('2026-07-30', set)
    const { diaries } = resolveDemoDiarySet(set, 'en', epoch)
    expect(diaries[diaries.length - 1].diaryDate).toBe('2026-07-30')
  })

  it('opens every memory unrecalled and at the foot of the gist ladder', () => {
    for (const set of DEMO_DIARY_SETS) {
      for (const memory of resolveDemoDiarySet(set, 'en', EPOCH).snapshot.memories) {
        expect(memory.recallCount).toBe(0)
        expect(memory.lastRecalledUniverseTime).toBeNull()
        expect(memory.semanticStage).toBe(0)
        expect(memory.forgettingOffsetDays).toBe(0)
      }
    }
  })
})

describe('set draw', () => {
  it('is total over the unit interval and set-granular', () => {
    for (let draw = 0; draw < 1; draw += 0.01) {
      expect(DEMO_DIARY_SETS).toContain(pickDemoDiarySet(DEMO_DIARY_SETS, draw))
    }
    expect(pickDemoDiarySet(DEMO_DIARY_SETS, 0)).toBe(DEMO_DIARY_SETS[0])
    expect(pickDemoDiarySet(DEMO_DIARY_SETS, 1)).toBe(DEMO_DIARY_SETS[DEMO_DIARY_SETS.length - 1])
    expect(pickDemoDiarySet(DEMO_DIARY_SETS, Number.NaN)).toBe(DEMO_DIARY_SETS[0])
    // Every set id is distinct, so a draw names one designed-together triple [Z4].
    expect(new Set(DEMO_DIARY_SETS.map((set) => set.structure.id)).size).toBe(
      DEMO_DIARY_SETS.length,
    )
  })
})

describe('per-diary draw', () => {
  const set = DEMO_DIARY_SETS[0]
  const pool = demoDiaryPool(set)

  it('walks the pool in canonical order — triple first, then the extras', () => {
    expect(pool.map((diary) => diary.id)).toEqual([
      ...set.structure.diaries.map((diary) => diary.id),
      ...set.structure.extraDiaries.map((diary) => diary.id),
    ])
  })

  it('is deterministic per draw number, cycles, and never repeats back-to-back', () => {
    for (let draw = 0; draw < pool.length * 2; draw += 1) {
      expect(pickDemoDiary(pool, draw)).toBe(pickDemoDiary(pool, draw))
      // Cycling: outlasting the pool starts over instead of hitting a wall ([Z4] as amended).
      expect(pickDemoDiary(pool, draw + pool.length)).toBe(pickDemoDiary(pool, draw))
      expect(pickDemoDiary(pool, draw + 1)).not.toBe(pickDemoDiary(pool, draw))
    }
    // One full pass covers every prepared diary exactly once before any repetition.
    const firstPass = Array.from({ length: pool.length }, (_, draw) => pickDemoDiary(pool, draw))
    expect(new Set(firstPass).size).toBe(pool.length)
    // A malformed draw number clamps to the pool's start rather than throwing mid-visit.
    expect(pickDemoDiary(pool, Number.NaN)).toBe(pool[0])
    expect(pickDemoDiary(pool, -3)).toBe(pool[0])
  })
})

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies?: Record<string, string>
}

describe('package isolation', () => {
  it('declares no dependency that could reach a transport, a price or a read mirror', () => {
    // This list IS the [I13] argument, not decoration: the demo is formally exempt from the
    // invariants, and an exempt sandbox is only safe while it cannot reach the real path. Nothing
    // here can obtain an `ApiTransport` (every RPC-issuing function in `packages/*` takes one as its
    // first argument), a Twinkle price or balance, or a server-backed read mirror — so a fixture
    // cannot accidentally become a product write. Anything added has to answer that first.
    //
    // What each entry buys: `emotion` for the mood→arousal→strength relationship the fixtures show
    // rather than hand-tune ([I3]), `memory` for the shapes the resolver returns, `memory-logic` for
    // the pinned read-time math ([Z5]: nothing is re-implemented), `i18n` for the `Locale` the text
    // split is keyed by. No `store` ([Z8]), no `twinkle`, no `api-client`, no `universe`.
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@cosimosi/emotion',
      '@cosimosi/i18n',
      '@cosimosi/memory',
      '@cosimosi/memory-logic',
    ])
    // `config` is a dev dependency because only this file reads `VALUES` — to assert the fixtures
    // against the shipped ratios. The resolver itself needs no tuning scalar, and a manifest that
    // said otherwise would overstate what the shipped package pulls in.
    expect(Object.keys(manifest.devDependencies)).toContain('@cosimosi/config')
    expect(manifest.peerDependencies).toBeUndefined()
  })
})
