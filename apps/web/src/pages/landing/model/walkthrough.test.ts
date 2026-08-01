import { describe, expect, it } from 'vitest'

import { starChannels } from '@cosimosi/universe'

import { walkthroughContent } from '../config/walkthrough-content.ts'
import {
  INITIAL_WALKTHROUGH_STATE,
  WALKTHROUGH_STEPS,
  actOnWalkthroughStep,
  advanceWalkthrough,
  isLastWalkthroughStep,
  restartWalkthrough,
  seedFromText,
  walkthroughSceneFacts,
  type WalkthroughState,
  type WalkthroughStepId,
} from './walkthrough.ts'

const at = (step: WalkthroughStepId, acted: boolean): WalkthroughState => ({ step, acted })

describe('the walkthrough steps', () => {
  it('are the prescribed six, in order, ending in the mirror', () => {
    // The [M5] guard that used to be the section tuple's 'mirror' entry: the definition's home is
    // the final step, and dropping or reordering it is a tsc failure — this pins the runtime side.
    expect(WALKTHROUGH_STEPS).toEqual(['split', 'launch', 'color', 'fade', 'recall', 'mirror'])
    expect(WALKTHROUGH_STEPS[WALKTHROUGH_STEPS.length - 1]).toBe('mirror')
    expect(new Set(WALKTHROUGH_STEPS).size).toBe(WALKTHROUGH_STEPS.length)
  })
})

describe('the walkthrough progression', () => {
  it('only moves forward, one acted step at a time', () => {
    expect(advanceWalkthrough(INITIAL_WALKTHROUGH_STATE)).toEqual(INITIAL_WALKTHROUGH_STATE)

    let state = INITIAL_WALKTHROUGH_STATE
    const visited: WalkthroughStepId[] = [state.step]
    while (!(isLastWalkthroughStep(state) && state.acted)) {
      state = state.acted ? advanceWalkthrough(state) : actOnWalkthroughStep(state)
      if (visited[visited.length - 1] !== state.step) visited.push(state.step)
    }
    // The only path through is the tuple itself; there is no API that moves backwards.
    expect(visited).toEqual([...WALKTHROUGH_STEPS])
  })

  it('stays at the mirror once there, except for a restart', () => {
    const end = at('mirror', true)
    expect(advanceWalkthrough(end)).toEqual(end)
    expect(restartWalkthrough()).toEqual(INITIAL_WALKTHROUGH_STATE)
  })

  it('acts idempotently', () => {
    expect(actOnWalkthroughStep(at('split', true))).toEqual(at('split', true))
  })
})

describe('the authored story', () => {
  it('is deterministic: the same state always shows the same scene, in both locales', () => {
    for (const locale of ['ko', 'en'] as const) {
      const content = walkthroughContent(locale)
      for (const step of WALKTHROUGH_STEPS) {
        expect(walkthroughSceneFacts(content, at(step, true))).toEqual(
          walkthroughSceneFacts(content, at(step, true)),
        )
      }
    }
  })

  it('tells the same story in both languages', () => {
    // Words differ; the structure the visuals derive from may not, or the two locales would show
    // two different skies.
    const ko = walkthroughContent('ko')
    const en = walkthroughContent('en')
    expect(ko.splitScenes.map((scene) => scene.mood)).toEqual(
      en.splitScenes.map((scene) => scene.mood),
    )
    expect(ko.laterEntries.map((entry) => entry.mood)).toEqual(
      en.laterEntries.map((entry) => entry.mood),
    )
    expect(ko.laterEntries.map((entry) => entry.dayOffset)).toEqual(
      en.laterEntries.map((entry) => entry.dayOffset),
    )
    expect(ko.recall.sceneIndex).toBe(en.recall.sceneIndex)
  })

  it('keeps every coordinate out of the content', () => {
    // [I5]: where a memory stands on the canvas is the scene's layout concern, never an authored fact.
    const content = walkthroughContent('ko')
    for (const entry of [...content.splitScenes, ...content.laterEntries]) {
      expect(Object.keys(entry)).not.toContain('position')
      expect(Object.keys(entry)).not.toContain('coordinates')
    }
  })
})

describe('the scene facts, through the production functions', () => {
  const content = walkthroughContent('ko')
  const targetId = `landing-walk-scene-${content.recall.sceneIndex}`
  const target = (state: WalkthroughState) => {
    const facts = walkthroughSceneFacts(content, state)
    const memory = facts.memories.find((candidate) => candidate.id === targetId)
    if (!memory) throw new Error('recall target missing from the scene')
    return { facts, memory, channel: starChannels(memory, facts.universeTime) }
  }

  it('shows no memories before the launch, and the whole cast after the accumulation', () => {
    expect(walkthroughSceneFacts(content, at('split', true)).memories).toHaveLength(0)
    expect(walkthroughSceneFacts(content, at('launch', true)).memories).toHaveLength(
      content.splitScenes.length,
    )
    expect(walkthroughSceneFacts(content, at('color', true)).memories).toHaveLength(
      content.splitScenes.length + content.laterEntries.length,
    )
  })

  it('fills the sky at the colour step, not before', () => {
    expect(walkthroughSceneFacts(content, at('launch', true)).skyStops).toHaveLength(0)
    const stops = walkthroughSceneFacts(content, at('color', true)).skyStops
    expect(stops.length).toBeGreaterThan(0)
    expect(stops.reduce((sum, stop) => sum + stop.weight, 0)).toBeCloseTo(1, 6)
  })

  it('dims and erodes with the fade, through the shipped decay', () => {
    const before = target(at('color', true))
    const after = target(at('fade', true))
    expect(after.channel.brightness).toBeLessThan(before.channel.brightness)
    // The word loss is the persisted production erosion — redaction tokens in, words gone.
    expect(after.facts.focusText).not.toBe(content.splitScenes[content.recall.sceneIndex].text)
    expect(after.facts.focusText).toContain('xxxx')
  })

  it('returns on recall — brighter, larger, and changed in words and form', () => {
    const faded = target(at('fade', true))
    const recalled = target(at('recall', true))
    expect(recalled.channel.brightness).toBeGreaterThan(faded.channel.brightness)
    expect(recalled.channel.size).toBeGreaterThan(faded.channel.size)
    expect(recalled.facts.focusText).toBe(content.recall.reconsolidatedText)
    expect(recalled.memory.seed).not.toEqual(faded.memory.seed)
    expect(seedFromText('a')).not.toEqual(seedFromText('b'))
  })

  it('tilts the sky towards the returned-to feeling at the mirror step ([M5])', () => {
    const recalled = target(at('recall', true))
    const mirrored = target(at('mirror', true))
    const mood = recalled.memory.emotion.mood
    const share = (facts: (typeof recalled)['facts']) =>
      facts.skyStops.find((stop) => stop.mood === mood)?.weight ?? 0
    expect(share(mirrored.facts)).toBeGreaterThan(share(recalled.facts))
  })
})
