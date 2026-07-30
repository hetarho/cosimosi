import { useCallback, useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  DEMO_DIARY_SETS,
  pickDemoDiarySet,
  resolveDemoDiarySet,
  resolveDemoEpoch,
  type DemoDiarySet,
  type ResolvedDemoDiarySet,
} from '@cosimosi/demo'
import type { EpisodicMemory, Neuron, Synapse } from '@cosimosi/memory'
import { reshape, SEMANTIC_MAX_STAGE } from '@cosimosi/memory-logic'

import { getActiveLocale } from '../../../shared/i18n/index.ts'

// pages/demo model: the whole sandbox, held in ONE piece of page state that dies with the route.
//
// Everything the beats do happens here and only here. That is the load-bearing half of [I13]: free
// time travel, no cost gate and a rewindable clock are all expressible because they are page state —
// no shared package, feature or entity has a demo flag, a demo branch or a bypass to offer, and none
// of them knows this page exists.

// The taste is three renderer keys and a boolean — no id kept, no ownership, no total. A catalog id
// arrives as `<kind-prefix>.<key>`, and the renderer key is the part after the dot, so this page
// resolves it with `ornamentRegistryKey` below rather than importing `@cosimosi/store` (whose barrel
// also carries the pricing functions — and [Z8] is only structural while there is no path to them).
export interface DemoTaste {
  readonly background: string | null
  /** Named for what the visitor is shown — the shape a memory takes. The renderer's own word for it
   *  is rendering vocabulary and belongs on the other side of the projection (§3.4). */
  readonly bodyShape: string | null
  readonly palette: boolean
}

/** The renderer key inside a catalog ornament id (`background.soft-aurora` → `soft-aurora`). */
export function ornamentRendererKey(ornamentId: string): string {
  const dot = ornamentId.indexOf('.')
  return dot === -1 ? ornamentId : ornamentId.slice(dot + 1)
}

interface DemoRunState {
  readonly runId: string
  readonly set: DemoDiarySet
  readonly epoch: string
  readonly resolved: ResolvedDemoDiarySet
  readonly splitRevealed: boolean
  /** Which diaries have been launched — beat 3 launches the first, beat 4 adds the other two. */
  readonly launchedDiaryIds: readonly string[]
  /** A plain mutable ISO date. No monotonicity check, no launch precondition, no consent modal and
   *  no diary-date constraint — the demo just passes this down as the `universeTime` the layers
   *  already accept, which is why the exemption needs no shared-code support. */
  readonly clock: string
  readonly recalled: boolean
  /** The gist ladder position, demo-local: the FE `EpisodicMemory` mirror has no gist-timer anchor,
   *  and adding one for the sandbox's benefit would be a demo field in `packages/memory`. */
  readonly gistStage: number
  readonly skyFilled: boolean
  readonly taste: DemoTaste
}

const NO_TASTE: DemoTaste = { background: null, bodyShape: null, palette: false }

function freshRun(today: string, draw01: number, runId: string): DemoRunState {
  const set = pickDemoDiarySet(DEMO_DIARY_SETS, draw01)
  const epoch = resolveDemoEpoch(today, set)
  // The fixture text is CONTENT, not message keys, so the set is resolved for whichever locale the
  // app is showing — read through the app's i18n seam like every other locale consumer.
  const resolved = resolveDemoDiarySet(set, getActiveLocale(), epoch)
  return {
    runId,
    set,
    epoch,
    resolved,
    splitRevealed: false,
    launchedDiaryIds: [],
    // The universe opens at its own last launch, so beat 5 has somewhere to travel FROM.
    clock: resolved.snapshot.universeTime ?? epoch,
    recalled: false,
    gistStage: 0,
    skyFilled: false,
    taste: NO_TASTE,
  }
}

export interface DemoRun {
  readonly state: DemoRunState
  readonly scene: DemoScene
  /** Beat 1 — draw a set and show its first diary. Also the replay entry. */
  restart: (today: string, draw01: number, runId: string) => void
  revealSplit: () => void
  launchFirstDiary: () => void
  addRemainingDiaries: () => void
  advanceClock: () => void
  recall: () => void
  riseGist: () => void
  fillSky: () => void
  taste: (next: Partial<DemoTaste>) => void
}

export interface DemoScene {
  readonly memories: readonly EpisodicMemory[]
  readonly neurons: readonly Neuron[]
  readonly synapses: readonly Synapse[]
  readonly universeTime: string
  /** Announced to the awaken layer — the neurons this launch genuinely brought into being. */
  readonly newNeuronIds: readonly string[]
  /** Beat 8 has happened: the sky may take the universe's own colour. */
  readonly skyFilled: boolean
}

export function useDemoRun(initial: { today: string; draw01: number; runId: string }): DemoRun {
  const [state, setState] = useState<DemoRunState>(() =>
    freshRun(initial.today, initial.draw01, initial.runId),
  )

  const restart = useCallback(
    (today: string, draw01: number, runId: string) => setState(freshRun(today, draw01, runId)),
    [],
  )

  const revealSplit = useCallback(() => setState((run) => ({ ...run, splitRevealed: true })), [])

  const launchFirstDiary = useCallback(
    () =>
      setState((run) => ({
        ...run,
        launchedDiaryIds: [run.set.structure.diaries[0].id],
        // The universe's clock arrives at the launched diary's date, the way a real launch sets it.
        clock: run.resolved.diaries[0].diaryDate,
      })),
    [],
  )

  const addRemainingDiaries = useCallback(
    () =>
      setState((run) => ({
        ...run,
        launchedDiaryIds: run.set.structure.diaries.map((diary) => diary.id),
        clock: run.resolved.diaries[run.resolved.diaries.length - 1].diaryDate,
      })),
    [],
  )

  const advanceClock = useCallback(
    () =>
      setState((run) => ({
        ...run,
        clock: shiftDays(run.clock, VALUES.demo.timeTravelStepDays),
      })),
    [],
  )

  const recall = useCallback(() => setState((run) => ({ ...run, recalled: true })), [])

  const riseGist = useCallback(
    () =>
      setState((run) => ({
        ...run,
        gistStage: Math.min(run.gistStage + 1, SEMANTIC_MAX_STAGE),
        clock: shiftDays(run.clock, VALUES.demo.timeTravelStepDays),
      })),
    [],
  )

  const fillSky = useCallback(() => setState((run) => ({ ...run, skyFilled: true })), [])

  const taste = useCallback(
    (next: Partial<DemoTaste>) => setState((run) => ({ ...run, taste: { ...run.taste, ...next } })),
    [],
  )

  const scene = useMemo(() => projectScene(state), [state])

  return {
    state,
    scene,
    restart,
    revealSplit,
    launchFirstDiary,
    addRemainingDiaries,
    advanceClock,
    recall,
    riseGist,
    fillSky,
    taste,
  }
}

// The scene the render layers receive: the resolved fixture narrowed to what has been launched, with
// the recall and gist beats applied. Every derived quantity the layers show — brightness, size, the
// eroded text, the gist coordinate, the sky's blend — is computed downstream by the shipped
// functions from exactly these stored facts, which is why the beats only ever move stored facts.
function projectScene(run: DemoRunState): DemoScene {
  const launched = new Set(run.launchedDiaryIds)
  const launchedMemoryIds = new Set(
    run.set.structure.diaries
      .filter((diary) => launched.has(diary.id))
      .flatMap((diary) => diary.memories.map((memory) => memory.id)),
  )

  const memories = run.resolved.snapshot.memories
    .filter((memory) => launchedMemoryIds.has(memory.id))
    .map((memory) => applyBeats(memory, run))

  const activeNeuronIds = new Set(
    memories.flatMap((memory) => memory.activations.map((activation) => activation.neuronId)),
  )
  const neurons = run.resolved.snapshot.neurons.filter((neuron) => activeNeuronIds.has(neuron.id))

  // An edge appears only once two neurons have CO-FIRED in a memory that has actually launched —
  // the server's own formation rule, applied to the subset the visitor has sent up. Filtering on
  // "both endpoints exist" instead would be wrong AND would flatten the fourth beat: one diary can
  // easily touch every neuron in a set, so every authored edge would already be drawn before the
  // second and third diaries arrived, and the beat would have nothing to add.
  const coFired = new Set(
    memories.flatMap((memory) => {
      const ids = memory.activations.map((activation) => activation.neuronId)
      return ids.flatMap((a) => ids.filter((b) => a < b).map((b) => `${a}|${b}`))
    }),
  )
  const synapses = run.resolved.snapshot.synapses.filter((synapse) =>
    coFired.has(`${synapse.neuronAId}|${synapse.neuronBId}`),
  )

  return {
    memories,
    neurons,
    synapses,
    universeTime: run.clock,
    newNeuronIds: neurons.map((neuron) => neuron.id),
    skyFilled: run.skyFilled,
  }
}

function applyBeats(memory: EpisodicMemory, run: DemoRunState): EpisodicMemory {
  const { scenario } = run.set
  let next = memory

  if (run.recalled && memory.id === scenario.recallMemoryId) {
    // A recall moves four stored facts and nothing else. The eroded words come BACK on their own:
    // the last-recall anchor resets the elapsed clock, so `currentDecayText` reads stage 0 again —
    // recovery is a re-render, never a rewrite ([F5][I8]).
    next = {
      ...next,
      recallCount: next.recallCount + 1,
      lastRecalledUniverseTime: run.clock,
      // The form changes because the memory came back changed [V5]. `reshape` guarantees a seed
      // different from the current one; the fresh entropy is derived from the run so a replay of the
      // same set reshapes the same way.
      seed: BigInt(reshape(Number(next.seed ?? 0n), seedFromRun(run))),
      currentText: run.resolved.reconsolidatedTexts[memory.id] ?? next.currentText,
    }
  }

  if (run.gistStage > 0 && memory.id === scenario.gistRiseMemoryId) {
    next = { ...next, semanticStage: run.gistStage }
  }

  return next
}

// A run-stable, set-stable number: the same set replayed reshapes to the same form, so the demo stays
// deterministic under [Z5] while still showing a form that visibly changed.
function seedFromRun(run: DemoRunState): number {
  let hash = 2166136261
  for (const character of run.set.structure.id) {
    hash = (Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0) % Number.MAX_SAFE_INTEGER
  }
  return hash
}

// ISO-date arithmetic for the demo clock. Parsed as UTC midnight, so no timezone can move the date.
function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * 86_400_000).toISOString().slice(0, 10)
}
