// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DEMO_BEAT_IDS, DEMO_DIARY_SETS, demoDiaryPool } from '@cosimosi/demo'
import type { EpisodicMemory } from '@cosimosi/memory'
import { SEMANTIC_MAX_STAGE, decayStageText } from '@cosimosi/memory-logic'
import { resetMoodPalette, paletteVersion } from '@cosimosi/emotion'
import { applyMoodColors } from '@cosimosi/emotion/react'
import {
  currentDecayStage,
  currentDecayText,
  resetUniverseUserState,
  useEpisodicMemoryStore,
  useNeuronStore,
  useSynapseStore,
} from '@cosimosi/universe'

import { DEMO_SCRIPT } from './script.ts'
import { DEMO_TIME_JUMPS, ornamentRendererKey, useDemoRun } from './use-demo-run.ts'

const ENTRY = { today: '2026-07-30', draw01: 0, runId: 'run-1' }

afterEach(() => {
  cleanup()
  resetUniverseUserState()
  resetMoodPalette()
})

function mountRun(draw01 = ENTRY.draw01) {
  return renderHook(() => useDemoRun({ ...ENTRY, draw01 }))
}

type Run = ReturnType<typeof mountRun>['result']

/** One full pass of the write flow: the draft on screen goes up. */
function launchDraft(result: Run) {
  act(() => result.current.revealSplit())
  act(() => result.current.launchDiary())
}

describe('the demo run', () => {
  it('draws one set and keeps every derived fact identical for it', () => {
    const first = mountRun()
    const second = mountRun()
    // Only WHICH set varies between runs; the same draw yields the same split, byte for byte.
    expect(second.result.current.state.set.structure.id).toBe(
      first.result.current.state.set.structure.id,
    )
    expect(second.result.current.state.resolved).toEqual(first.result.current.state.resolved)
  })

  it('opens with the first diary drafted and nothing launched', () => {
    const { result } = mountRun()
    expect(result.current.state.writing?.diaryId).toBe(
      result.current.state.set.scenario.firstDiaryId,
    )
    expect(result.current.writingDiary?.body).toBeTruthy()
    expect(result.current.scene.memories).toHaveLength(0)
    expect(result.current.scene.neurons).toHaveLength(0)
  })

  // Every set the draw can land on, because the beat-4 property is a property of each one: the
  // drawn second diary must bring edges the first one had not formed, or the neuron-reuse beat
  // would have nothing to show — and the visitor meets each set one time in three.
  it.each(DEMO_DIARY_SETS.map((set, index) => [set.structure.id, index / DEMO_DIARY_SETS.length]))(
    'brings new edges in with the second drawn diary of %s',
    (_id, draw01) => {
      const { result } = mountRun(draw01)

      launchDraft(result)
      const afterFirst = result.current.scene
      expect(afterFirst.memories.length).toBeGreaterThan(0)

      act(() => result.current.drawDiary())
      launchDraft(result)
      const afterSecond = result.current.scene
      expect(afterSecond.memories.length).toBeGreaterThan(afterFirst.memories.length)
      // The second diary co-fires pairs the first one never did, so new edges ARRIVE.
      expect(afterSecond.synapses.length).toBeGreaterThan(afterFirst.synapses.length)
      expect(afterSecond.neurons.length).toBeGreaterThanOrEqual(afterFirst.neurons.length)
    },
  )

  it('keeps writing as deep as the pool is, one prepared diary per draw', () => {
    const { result } = mountRun()
    const pool = demoDiaryPool(result.current.state.set)

    const drafted: string[] = [result.current.state.writing?.diaryId ?? '']
    launchDraft(result)
    for (let draw = 1; draw < pool.length; draw += 1) {
      act(() => result.current.drawDiary())
      const draftId = result.current.state.writing?.diaryId ?? ''
      // No immediate repetition, and the same UI shapes every time: a draft with a body, a split
      // to reveal, a launch that lands it in the scene.
      expect(draftId).not.toBe(drafted[drafted.length - 1])
      drafted.push(draftId)
      expect(result.current.writingDiary?.body).toBeTruthy()
      launchDraft(result)
    }

    // One pass covered every prepared diary exactly once — the pool's whole depth ([Z4] amended).
    expect(new Set(drafted).size).toBe(pool.length)
    expect(result.current.state.launchedDiaryIds).toHaveLength(pool.length)
    const memoryCount = pool.reduce((count, diary) => count + diary.memories.length, 0)
    expect(result.current.scene.memories).toHaveLength(memoryCount)

    // The pool cycles rather than hitting a wall: the next draw re-presents a diary, and sending
    // it up again changes nothing.
    act(() => result.current.drawDiary())
    launchDraft(result)
    expect(result.current.state.launchedDiaryIds).toHaveLength(pool.length)
  })

  it('draws one draft at a time — a repeated press moves the pool cursor nowhere', () => {
    const { result } = mountRun()
    const openingDraft = result.current.state.writing?.diaryId

    // The opening diary is still on screen: pressing the writing control again must not skip the
    // authored second diary the neuron-reuse beat depends on.
    act(() => result.current.drawDiary())
    act(() => result.current.drawDiary())
    expect(result.current.state.writing?.diaryId).toBe(openingDraft)
    expect(result.current.state.drawCount).toBe(1)

    launchDraft(result)
    act(() => result.current.drawDiary())
    expect(result.current.state.writing?.diaryId).toBe(
      result.current.state.set.structure.diaries[1].id,
    )
  })

  it('renders neuron↔neuron edges only, canonically ordered', () => {
    const { result } = mountRun()
    launchDraft(result)
    act(() => result.current.drawDiary())
    launchDraft(result)
    const neuronIds = new Set(result.current.scene.neurons.map((neuron) => neuron.id))
    const memoryIds = new Set(result.current.scene.memories.map((memory) => memory.id))
    for (const synapse of result.current.scene.synapses) {
      expect(neuronIds.has(synapse.neuronAId)).toBe(true)
      expect(neuronIds.has(synapse.neuronBId)).toBe(true)
      expect(memoryIds.has(synapse.neuronAId)).toBe(false)
      expect(memoryIds.has(synapse.neuronBId)).toBe(false)
      expect(synapse.neuronAId < synapse.neuronBId).toBe(true)
    }
  })

  it('advances the clock by all three grains, freely and unbounded', () => {
    const { result } = mountRun()
    launchDraft(result)
    const before = result.current.state.clock

    act(() => result.current.advanceClock(DEMO_TIME_JUMPS.day))
    expect(daysBetween(before, result.current.state.clock)).toBe(1)
    act(() => result.current.advanceClock(DEMO_TIME_JUMPS.week))
    expect(daysBetween(before, result.current.state.clock)).toBe(8)
    act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
    expect(daysBetween(before, result.current.state.clock)).toBe(8 + DEMO_TIME_JUMPS.month)

    // Unbounded: there is no launch precondition, no consent step and no ceiling to hit.
    for (let press = 0; press < 20; press += 1)
      act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
    expect(daysBetween(before, result.current.state.clock)).toBe(8 + DEMO_TIME_JUMPS.month * 21)
  })

  it('moves the clock to a launched diary’s date and never backwards', () => {
    const { result } = mountRun()
    launchDraft(result)
    const firstDate = result.current.state.clock

    // A deep jump past the next diary's date: launching it must not rewind the clock.
    for (let press = 0; press < 12; press += 1)
      act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
    const jumped = result.current.state.clock
    expect(jumped > firstDate).toBe(true)

    act(() => result.current.drawDiary())
    launchDraft(result)
    expect(result.current.state.clock).toBe(jumped)
  })

  it('recalls per memory, repeatably, moving stored facts and rewriting no diary', () => {
    const { result } = mountRun()
    launchDraft(result)
    act(() => result.current.drawDiary())
    launchDraft(result)
    const targetId = result.current.state.set.scenario.recallMemoryId
    const before = find(result.current.scene.memories, targetId)
    const diaryBodiesBefore = result.current.state.resolved.diaries.map((diary) => diary.body)

    act(() => result.current.recall(targetId))
    const once = find(result.current.scene.memories, targetId)
    expect(once.recallCount).toBe(before.recallCount + 1)
    expect(once.lastRecalledUniverseTime).toBe(result.current.state.clock)
    expect(once.seed).not.toBe(before.seed)
    expect(once.currentText).not.toBe(before.currentText)

    // Repeatable: a second recall moves the same facts again — and reshapes AGAIN.
    act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
    act(() => result.current.recall(targetId))
    const twice = find(result.current.scene.memories, targetId)
    expect(twice.recallCount).toBe(before.recallCount + 2)
    expect(twice.seed).not.toBe(once.seed)

    // Per-memory: any other launched memory recalls too, with no cost surface anywhere.
    const otherId = result.current.scene.memories.find((memory) => memory.id !== targetId)?.id
    expect(otherId).toBeTruthy()
    act(() => result.current.recall(otherId ?? ''))
    expect(find(result.current.scene.memories, otherId ?? '').recallCount).toBe(1)

    // The diaries themselves are untouched — a memory is a representation, never the thing [I2].
    expect(result.current.state.resolved.diaries.map((diary) => diary.body)).toEqual(
      diaryBodiesBefore,
    )
    // And nothing else moved: emotion, base strength and the neuron membership are the same facts.
    expect(twice.emotion).toEqual(before.emotion)
    expect(twice.baseStrength).toBe(before.baseStrength)
    expect(twice.activations).toEqual(before.activations)
  })

  // Beat 6 is the demo's most-watched demonstration of [I8] — "come back a little changed" — and it
  // only holds if the reading the recall produced is the one that erodes afterwards. The clock has to
  // move AFTER the recall for this to be visible at all, which is exactly what no other test here did.
  it('erodes the reconsolidated reading after a recall, never the original text', () => {
    const { result } = mountRun()
    launchDraft(result)
    act(() => result.current.drawDiary())
    launchDraft(result)
    const targetId = result.current.state.set.scenario.recallMemoryId
    const original = find(result.current.scene.memories, targetId)

    act(() => result.current.recall(targetId))
    const recalled = find(result.current.scene.memories, targetId)
    // The recall itself resets the anchors, so the whole reconsolidated reading is what shows now.
    expect(currentDecayText(recalled, result.current.state.clock)).toBe(recalled.currentText)
    expect(recalled.currentText).not.toBe(original.currentText)

    // Now push time until the stage climbs back off zero. The words that go are the reconsolidated
    // reading's — the ladder authored for the pre-recall text is not what the visitor is reading.
    let eroded = recalled
    for (
      let press = 0;
      press < 12 && currentDecayStage(eroded, result.current.state.clock) < 1;
      press += 1
    ) {
      act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
      eroded = find(result.current.scene.memories, targetId)
    }
    const stage = currentDecayStage(eroded, result.current.state.clock)
    expect(stage).toBeGreaterThanOrEqual(1)
    expect(currentDecayText(eroded, result.current.state.clock)).toBe(
      decayStageText(recalled.currentText, stage, recalled.seed ?? 0n),
    )
    // And explicitly NOT the original text's ladder, which is what the fixture still carries.
    expect(currentDecayText(eroded, result.current.state.clock)).not.toBe(
      original.decayStages[stage - 1],
    )

    // The never-recalled path is untouched: every other launched memory still carries the AUTHORED
    // ladder byte for byte, not a recomputation that merely agrees with it.
    const untouched = result.current.scene.memories.filter((memory) => memory.id !== targetId)
    expect(untouched.length).toBeGreaterThan(0)
    for (const memory of untouched) {
      const fixture = result.current.state.resolved.snapshot.memories.find(
        (candidate) => candidate.id === memory.id,
      )
      expect(memory.decayStages).toBe(fixture?.decayStages)
    }
  })

  // The second half of the same rule, one level down: the ladder is a function of the text AND the
  // seed. A recall reshapes the seed every time, so a recall that leaves the WORDS alone — a repeat
  // recall, or the first recall of any memory the fixture wrote no reconsolidated text for, which in
  // free play is most of them — still has to re-erode. Otherwise the visitor reads the previous
  // form's word loss under the current form.
  it('re-erodes on a recall that reshapes the form but not the words', () => {
    const { result } = mountRun()
    launchDraft(result)
    act(() => result.current.drawDiary())
    launchDraft(result)
    const targetId = result.current.state.set.scenario.recallMemoryId
    // Recall twice: the second pass finds `reconsolidatedTexts` already applied, so only the seed moves.
    act(() => result.current.recall(targetId))
    const once = find(result.current.scene.memories, targetId)
    act(() => result.current.recall(targetId))
    const twice = find(result.current.scene.memories, targetId)
    expect(twice.currentText).toBe(once.currentText)
    expect(twice.seed).not.toBe(once.seed)

    let eroded = twice
    for (
      let press = 0;
      press < 12 && currentDecayStage(eroded, result.current.state.clock) < 1;
      press += 1
    ) {
      act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
      eroded = find(result.current.scene.memories, targetId)
    }
    const stage = currentDecayStage(eroded, result.current.state.clock)
    expect(stage).toBeGreaterThanOrEqual(1)
    expect(currentDecayText(eroded, result.current.state.clock)).toBe(
      decayStageText(twice.currentText, stage, twice.seed ?? 0n),
    )
    expect(currentDecayText(eroded, result.current.state.clock)).not.toBe(
      once.decayStages[stage - 1],
    )
  })

  it('climbs gist stages per memory as time passes, and a recall re-anchors without lowering', () => {
    const { result } = mountRun()
    launchDraft(result)
    act(() => result.current.drawDiary())
    launchDraft(result)

    // A launch moves the clock (the second diary is days newer), but launching is not pushed
    // time: EVERY gist timer rides the jump, so writing alone raises nobody's stage.
    for (const memory of result.current.scene.memories) {
      expect(memory.semanticStage).toBe(0)
    }

    // Left unrecalled while time advances, they climb — per memory, from its own timer.
    for (let press = 0; press < 6; press += 1)
      act(() => result.current.advanceClock(DEMO_TIME_JUMPS.month))
    const climbed = result.current.scene.memories.filter((memory) => memory.semanticStage > 0)
    expect(climbed.length).toBeGreaterThan(0)
    for (const memory of result.current.scene.memories) {
      expect(memory.semanticStage).toBeLessThanOrEqual(SEMANTIC_MAX_STAGE)
    }

    // A recall re-anchors the timer but never lowers the reached stage ([C7]).
    const targetId = climbed[0].id
    const reached = climbed[0].semanticStage
    act(() => result.current.recall(targetId))
    expect(find(result.current.scene.memories, targetId).semanticStage).toBe(reached)
    // ...and the re-anchored timer delays the NEXT stage relative to an unrecalled peer.
    act(() => result.current.advanceClock(DEMO_TIME_JUMPS.week))
    expect(find(result.current.scene.memories, targetId).semanticStage).toBe(reached)
  })

  it('keeps the taste to renderer keys, changing no memory fact', () => {
    const { result } = mountRun()
    launchDraft(result)
    const before = result.current.scene.memories

    act(() =>
      result.current.taste({
        background: 'soft-aurora',
        bodyShape: 'prism',
        summaryShape: 'corona',
        mote: 'ember-bokeh',
        moteField: 'milky-way',
      }),
    )
    expect(result.current.state.taste).toEqual({
      background: 'soft-aurora',
      bodyShape: 'prism',
      summaryShape: 'corona',
      mote: 'ember-bokeh',
      moteField: 'milky-way',
      palette: false,
    })
    // Decoration cannot touch meaning: no position, size, brightness, emotion or seed moved.
    expect(result.current.scene.memories).toEqual(before)
  })
})

describe('the ornament id seam', () => {
  it('reads the renderer key out of a catalog id without reaching the catalog', () => {
    expect(ornamentRendererKey('background.soft-aurora')).toBe('soft-aurora')
    expect(ornamentRendererKey('star_shader.prism')).toBe('prism')
    // An id with no prefix is passed through rather than truncated to nothing.
    expect(ornamentRendererKey('prism')).toBe('prism')
  })
})

describe('the demo script', () => {
  it('carries the ten beats in order, each with a caption', () => {
    expect(DEMO_SCRIPT.steps.map((step) => step.id)).toEqual([...DEMO_BEAT_IDS])
    for (const step of DEMO_SCRIPT.steps) {
      // Accessors, not strings — every sentence is a reviewed catalogue entry.
      expect(typeof step.caption).toBe('function')
      expect(step.caption().trim()).not.toBe('')
    }
  })

  it('carries no handler, no cost and nothing priced', () => {
    // The engine's step model has no field for an action, a price or a skip opt-out, so the guard is
    // really the type — this records the resulting vocabulary so a widened step is visible in a diff.
    for (const step of DEMO_SCRIPT.steps) {
      expect(Object.keys(step).sort()).toEqual(
        step.anchor ? ['advance', 'anchor', 'caption', 'id'] : ['advance', 'caption', 'id'],
      )
    }
  })

  it('waits on the visitor for every beat they have to perform', () => {
    const performed = [
      'diary_appears',
      'split',
      'launch',
      'neuron_reuse',
      'time_accelerates',
      'recall',
    ]
    for (const id of performed) {
      const step = DEMO_SCRIPT.steps.find((candidate) => candidate.id === id)
      // A dwell step here would advance the tour past work nobody did.
      expect(step?.advance.on).toBe('signal')
    }
  })
})

describe('nothing carries over', () => {
  it('leaves the read models and the palette clean when the page tears down', () => {
    // The page's own teardown calls exactly these two; both stores are module-level and would
    // otherwise outlive the route, so a tasted palette could reach the next session's first paint.
    useEpisodicMemoryStore.getState().setAll([])
    applyMoodColors([{ mood: 'JOY', color: '#ff0000' }])
    const tastedVersion = paletteVersion()

    resetUniverseUserState()
    resetMoodPalette()

    expect(useEpisodicMemoryStore.getState().ids).toEqual([])
    expect(useNeuronStore.getState().ids).toEqual([])
    expect(useSynapseStore.getState().ids).toEqual([])
    expect(paletteVersion()).not.toBe(tastedVersion)
  })
})

function find(memories: readonly EpisodicMemory[], id: string): EpisodicMemory {
  const found = memories.find((memory) => memory.id === id)
  if (!found) throw new Error(`the scene has no ${id}`)
  return found
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}
