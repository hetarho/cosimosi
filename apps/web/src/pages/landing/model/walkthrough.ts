import { VALUES } from '@cosimosi/config'
import {
  arousalToInitialStrength,
  createEmotion,
  toEmotionSlices,
  type EmotionSlice,
  type Mood,
} from '@cosimosi/emotion'
import { decayStageText, effectiveStrength, reshape } from '@cosimosi/memory-logic'
import { currentDecaySpans, currentDecayText, type DecayTextSpan } from '@cosimosi/universe'

import type { EpisodicMemory } from '@cosimosi/memory'

/**
 * The walkthrough's six steps, in the argument's order: a diary splits, the scenes launch as
 * memories, the sky takes the writer's colour, neglect dims, recall returns — and only then the one
 * sentence a new user must not get wrong. The `satisfies` clause restates the tuple, so removing a
 * step, reordering one, or dropping the closing `'mirror'` is a `tsc` failure rather than a review
 * catch. This tuple is the [M5] structural guard — the definition's required home on the page
 * (policy/ux/public-copy.md).
 */
export const WALKTHROUGH_STEPS = [
  'split',
  'launch',
  'color',
  'fade',
  'recall',
  'mirror',
] as const satisfies readonly ['split', 'launch', 'color', 'fade', 'recall', 'mirror']

export type WalkthroughStepId = (typeof WALKTHROUGH_STEPS)[number]

/**
 * What the stage holds at a given point in the run — exactly ONE of three things, never two at once:
 * the written day, the scenes the split found in it, or the universe those scenes launched into.
 *
 * The exclusivity is the argument. A diary that stayed on screen next to its own split would say the
 * entry and the scenes coexist; in the product the diary is consumed — splitting it is what produces
 * the scenes, and launching them is what produces the sky. Each step therefore REPLACES what came
 * before it, and the visitor watches the same handoff the writing flow performs.
 */
export type WalkthroughStageId = 'diary' | 'scenes' | 'universe'

/**
 * Where the visitor stands: which step, and whether its one action has been taken. The run is a
 * single fixed sequence walked one state at a time — `retreatWalkthrough` is `advance ∘ act`'s exact
 * inverse, so stepping back and forward again always lands on the same state and every full run
 * stays identical.
 */
export interface WalkthroughState {
  readonly step: WalkthroughStepId
  readonly acted: boolean
}

export const INITIAL_WALKTHROUGH_STATE: WalkthroughState = { step: 'split', acted: false }

/** Take the current step's single action. Idempotent: acting twice is acting once. */
export function actOnWalkthroughStep(state: WalkthroughState): WalkthroughState {
  return state.acted ? state : { step: state.step, acted: true }
}

/** Move to the next step — only forward, and only once the current step's action happened. */
export function advanceWalkthrough(state: WalkthroughState): WalkthroughState {
  if (!state.acted) return state
  const next = WALKTHROUGH_STEPS[WALKTHROUGH_STEPS.indexOf(state.step) + 1]
  return next === undefined ? state : { step: next, acted: false }
}

/** Step back one state — the exact inverse of the act/advance walk: an acted step returns to its
 *  prompt, an unacted step returns to the previous step's result. At the very start it holds. */
export function retreatWalkthrough(state: WalkthroughState): WalkthroughState {
  if (state.acted) return { step: state.step, acted: false }
  const index = WALKTHROUGH_STEPS.indexOf(state.step)
  return index <= 0 ? state : { step: WALKTHROUGH_STEPS[index - 1], acted: true }
}

export function restartWalkthrough(): WalkthroughState {
  return INITIAL_WALKTHROUGH_STATE
}

export function isLastWalkthroughStep(state: WalkthroughState): boolean {
  return state.step === WALKTHROUGH_STEPS[WALKTHROUGH_STEPS.length - 1]
}

/** One authored entry: a scene name, its feeling, the words, and the universe-day it was written. */
export interface WalkthroughEntry {
  readonly name: string
  readonly mood: Mood
  readonly text: string
  readonly dayOffset: number
}

/** A scene of the split diary — an entry plus the neurons the split hung it from (card content). */
export interface WalkthroughSplitScene extends WalkthroughEntry {
  readonly neurons: readonly string[]
}

/**
 * The whole authored story, locale-resolved: the diary, its precomputed split, the entries that
 * accumulate afterwards, and which scene the recall steps return to — with the changed reading it
 * comes back as. Content only: no coordinate is authored anywhere in it ([I5]).
 */
export interface WalkthroughContent {
  readonly diaryText: string
  readonly splitScenes: readonly [
    WalkthroughSplitScene,
    WalkthroughSplitScene,
    WalkthroughSplitScene,
  ]
  readonly laterEntries: readonly WalkthroughEntry[]
  readonly recall: {
    /** Index into `splitScenes` of the memory the recall and mirror steps act on. */
    readonly sceneIndex: 0 | 1 | 2
    /** The reading it comes back as — recall reconstructs, it does not replay. */
    readonly reconsolidatedText: string
  }
}

/** The walkthrough clock's fixed birth date — the day the diary is written. Any date works; one is honest. */
export const WALKTHROUGH_EPOCH = '2026-01-01'

/**
 * How far the fade step jumps. Both of these are tuned against `forgetting.*` and `synapse.*`, so they
 * live in `spec/values.yaml` with that reasoning rather than here — see the `landing:` group.
 */
export const WALKTHROUGH_FADE_SPAN_DAYS = VALUES.landing.walkthroughFadeSpanDays

/** How many recalls the mirror step accumulates on the one returned-to memory. */
export const WALKTHROUGH_MIRROR_RECALLS = VALUES.landing.walkthroughMirrorRecalls

/** Day n of the walkthrough clock as the ISO universe-time the domain functions read. */
export function walkthroughUniverseTime(day: number): string {
  const epochMs = Date.UTC(2026, 0, 1)
  return new Date(epochMs + Math.max(0, Math.round(day)) * 86_400_000).toISOString().slice(0, 10)
}

// Same modulus as the channel projection's seed normalization, so the whole [0,1) form range is
// reachable from ordinary sentences — and the same words always yield the same seed-form.
export function seedFromText(text: string): bigint {
  let hash = 0n
  for (const character of text) {
    hash = (hash * 31n + BigInt(character.codePointAt(0) ?? 0)) % 1_000_003n
  }
  return hash
}

/**
 * An authored entry as the domain sees one. Everything derived is the shipped rule: base strength
 * from the mood's arousal, the seed-form from the words, and the word-loss stages precomputed with
 * the production `decayStageText` — the walkthrough persists them up front exactly the way the
 * server's advance-time hook does, so `currentDecayText` reads the same erosion a real memory shows.
 */
export function walkthroughMemory(entry: WalkthroughEntry, id: string): EpisodicMemory {
  const emotion = createEmotion(entry.mood)
  const seed = seedFromText(entry.text)
  return {
    id,
    diaryId: `${id}-diary`,
    name: entry.name,
    emotion,
    baseStrength: arousalToInitialStrength(emotion.arousal),
    recallCount: 0,
    createdUniverseTime: walkthroughUniverseTime(entry.dayOffset),
    lastRecalledUniverseTime: null,
    seed,
    activations: [],
    decayStages: VALUES.forgetting.stageWordRemovalRatios.map((_, index) =>
      decayStageText(entry.text, index + 1, seed),
    ),
    forgettingOffsetDays: 0,
    currentText: entry.text,
    semanticStage: 0,
  }
}

/**
 * Everything the section renders for a given (content, state) pair — pure and total, so the same
 * step of the same story always shows the same scene. The visuals are the shipped behaviour over
 * these facts: brightness/size/form arrive through `starChannels` in the scene, erosion through the
 * persisted decay stages, and the sky through the strength-weighted slices below.
 */
export interface WalkthroughSceneFacts {
  readonly stage: WalkthroughStageId
  readonly memories: readonly EpisodicMemory[]
  readonly universeTime: string
  readonly skyStops: readonly EmotionSlice[]
  /** The returned-to memory's reading as it stands now — whole, eroding, or back changed. */
  readonly focusText: string | null
  /** The same reading cut into legible and lost runs, for the renderer that draws the erosion. */
  readonly focusSpans: readonly DecayTextSpan[] | null
}

// Whether `step`'s change has already happened from where the visitor stands: any earlier step's
// change has, the current step's only once acted.
function hasHappened(state: WalkthroughState, step: WalkthroughStepId): boolean {
  const at = WALKTHROUGH_STEPS.indexOf(state.step)
  const asked = WALKTHROUGH_STEPS.indexOf(step)
  return asked < at || (asked === at && state.acted)
}

export function walkthroughSceneFacts(
  content: WalkthroughContent,
  state: WalkthroughState,
): WalkthroughSceneFacts {
  const lastEntryDay = Math.max(0, ...content.laterEntries.map((entry) => entry.dayOffset))
  const fadeDay = lastEntryDay + WALKTHROUGH_FADE_SPAN_DAYS
  const universeTime = walkthroughUniverseTime(
    hasHappened(state, 'fade') ? fadeDay : hasHappened(state, 'color') ? lastEntryDay : 0,
  )

  const memories: EpisodicMemory[] = []
  if (hasHappened(state, 'launch')) {
    content.splitScenes.forEach((scene, index) => {
      memories.push(walkthroughMemory(scene, `landing-walk-scene-${index}`))
    })
  }
  if (hasHappened(state, 'color')) {
    content.laterEntries.forEach((entry, index) => {
      memories.push(walkthroughMemory(entry, `landing-walk-entry-${index}`))
    })
  }

  const targetId = `landing-walk-scene-${content.recall.sceneIndex}`
  const targetIndex = memories.findIndex((memory) => memory.id === targetId)
  if (targetIndex >= 0 && hasHappened(state, 'recall')) {
    const target = memories[targetIndex]
    memories[targetIndex] = {
      ...target,
      // The mirror step's extra recalls are what tilt the sky ([M5]); the recall step itself is one.
      recallCount: hasHappened(state, 'mirror') ? WALKTHROUGH_MIRROR_RECALLS : 1,
      lastRecalledUniverseTime: universeTime,
      // Recall reconstructs: the reading comes back changed, and the changed reading grows a
      // changed form — production `reshape` over the seed the new words would have grown.
      currentText: content.recall.reconsolidatedText,
      seed: BigInt(
        reshape(Number(target.seed ?? 0n), Number(seedFromText(content.recall.reconsolidatedText))),
      ),
    }
  }

  const focus = memories.find((memory) => memory.id === targetId) ?? null

  return {
    // Read off the facts rather than off the step list: the universe is on the stage exactly when
    // there is something in it, so the stage cannot disagree with what the canvas would draw.
    stage: memories.length > 0 ? 'universe' : hasHappened(state, 'split') ? 'scenes' : 'diary',
    memories,
    universeTime,
    // The sky arrives with the accumulation step, the way the demo's does — the moment the colour
    // shows up is the moment the caption says it does.
    skyStops: hasHappened(state, 'color') ? walkthroughSkyStops(memories) : [],
    // The plain string stays as the crossfade's identity — what changed is the words — while the
    // spans beside it are what gets drawn.
    focusText: focus === null ? null : currentDecayText(focus, universeTime),
    focusSpans: focus === null ? null : currentDecaySpans(focus, universeTime),
  }
}

/**
 * The sky as [M5] defines it: each memory weighs in with its EffectiveStrength — the size recall
 * accumulation grows ([R3]) — so the emotions the writer returns to claim more of the colour than
 * the ones merely written down. Composed of two shipped rules (`effectiveStrength` per memory,
 * `toEmotionSlices` for the normalized shares); nothing here invents a weighting.
 */
export function walkthroughSkyStops(memories: readonly EpisodicMemory[]): EmotionSlice[] {
  const weights = new Map<Mood, number>()
  for (const memory of memories) {
    const mood = memory.emotion.mood
    weights.set(
      mood,
      (weights.get(mood) ?? 0) + effectiveStrength(memory.baseStrength, memory.recallCount),
    )
  }
  return toEmotionSlices(weights)
}
