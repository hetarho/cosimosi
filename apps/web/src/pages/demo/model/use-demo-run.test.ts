// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { DEMO_BEAT_IDS, DEMO_DIARY_SETS } from '@cosimosi/demo'
import type { EpisodicMemory } from '@cosimosi/memory'
import { resetMoodPalette, paletteVersion } from '@cosimosi/emotion'
import { applyMoodColors } from '@cosimosi/emotion/react'
import {
  resetUniverseUserState,
  useEpisodicMemoryStore,
  useNeuronStore,
  useSynapseStore,
} from '@cosimosi/universe'

import { DEMO_SCRIPT } from './script.ts'
import { ornamentRendererKey, useDemoRun } from './use-demo-run.ts'

const ENTRY = { today: '2026-07-30', draw01: 0, runId: 'run-1' }

afterEach(() => {
  cleanup()
  resetUniverseUserState()
  resetMoodPalette()
})

function mountRun() {
  return renderHook(() => useDemoRun(ENTRY))
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

  it('opens with nothing launched, so the first beat has somewhere to go', () => {
    const { result } = mountRun()
    expect(result.current.scene.memories).toHaveLength(0)
    expect(result.current.scene.neurons).toHaveLength(0)
    expect(result.current.scene.skyFilled).toBe(false)
  })

  // Every set the draw can land on, because the beat-4 property is a property of each one: a set whose
  // first diary happened to form every authored edge would leave the beat with nothing to show, and
  // the visitor would meet that set one time in three.
  it.each(DEMO_DIARY_SETS.map((set, index) => [set.structure.id, index / DEMO_DIARY_SETS.length]))(
    'brings new edges in with the second and third diaries of %s',
    (_id, draw01) => {
      const { result } = renderHook(() => useDemoRun({ ...ENTRY, draw01 }))

      act(() => result.current.launchFirstDiary())
      const afterFirst = result.current.scene
      expect(afterFirst.memories.length).toBeGreaterThan(0)

      act(() => result.current.addRemainingDiaries())
      const afterAll = result.current.scene
      expect(afterAll.memories.length).toBeGreaterThan(afterFirst.memories.length)
      // The later diaries co-fire pairs the first one never did, so new edges ARRIVE.
      expect(afterAll.synapses.length).toBeGreaterThan(afterFirst.synapses.length)
      expect(afterAll.neurons.length).toBeGreaterThanOrEqual(afterFirst.neurons.length)
    },
  )

  it('renders neuron↔neuron edges only, canonically ordered', () => {
    const { result } = mountRun()
    act(() => result.current.addRemainingDiaries())
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

  it('advances the clock freely, with no monotonicity guard and no cost', () => {
    const { result } = mountRun()
    act(() => result.current.launchFirstDiary())
    const before = result.current.state.clock

    act(() => result.current.advanceClock())
    const after = result.current.state.clock
    expect(after > before).toBe(true)
    expect(daysBetween(before, after)).toBe(VALUES.demo.timeTravelStepDays)

    // Unbounded: there is no launch precondition, no consent step and no ceiling to hit.
    for (let press = 0; press < 20; press += 1) act(() => result.current.advanceClock())
    expect(daysBetween(before, result.current.state.clock)).toBe(
      VALUES.demo.timeTravelStepDays * 21,
    )
  })

  it('moves exactly four stored facts on a recall, and rewrites no diary', () => {
    const { result } = mountRun()
    act(() => result.current.addRemainingDiaries())
    const targetId = result.current.state.set.scenario.recallMemoryId
    const before = find(result.current.scene.memories, targetId)
    const diaryBodiesBefore = result.current.state.resolved.diaries.map((diary) => diary.body)

    act(() => result.current.recall())
    const after = find(result.current.scene.memories, targetId)

    expect(after.recallCount).toBe(before.recallCount + 1)
    expect(after.lastRecalledUniverseTime).toBe(result.current.state.clock)
    expect(after.seed).not.toBe(before.seed)
    expect(after.currentText).not.toBe(before.currentText)
    // The diary itself is untouched — a memory is a representation of it, never the thing.
    expect(result.current.state.resolved.diaries.map((diary) => diary.body)).toEqual(
      diaryBodiesBefore,
    )
    // And nothing else moved: emotion, base strength and the neuron membership are the same facts.
    expect(after.emotion).toEqual(before.emotion)
    expect(after.baseStrength).toBe(before.baseStrength)
    expect(after.activations).toEqual(before.activations)
  })

  it('raises only the gist target the scenario names, and never past the ladder', () => {
    const { result } = mountRun()
    act(() => result.current.addRemainingDiaries())
    const targetId = result.current.state.set.scenario.gistRiseMemoryId

    act(() => result.current.riseGist())
    expect(find(result.current.scene.memories, targetId).semanticStage).toBe(1)
    for (const memory of result.current.scene.memories) {
      if (memory.id !== targetId) expect(memory.semanticStage).toBe(0)
    }

    for (let press = 0; press < 10; press += 1) act(() => result.current.riseGist())
    expect(find(result.current.scene.memories, targetId).semanticStage).toBe(4)
  })

  it('keeps the taste to renderer keys, changing no memory fact', () => {
    const { result } = mountRun()
    act(() => result.current.addRemainingDiaries())
    const before = result.current.scene.memories

    act(() => result.current.taste({ background: 'soft-aurora', bodyShape: 'prism' }))
    expect(result.current.state.taste).toEqual({
      background: 'soft-aurora',
      bodyShape: 'prism',
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
