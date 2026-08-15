import { useCallback, useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  DEMO_DIARY_SETS,
  demoDiaryPool,
  pickDemoDiary,
  pickDemoDiarySet,
  resolveDemoDiarySet,
  resolveDemoEpoch,
  type DemoDiarySet,
  type ResolvedDemoDiarySet,
} from '@cosimosi/demo'
import type { Diary, EpisodicMemory, Neuron, Synapse } from '@cosimosi/memory'
import {
  decayStageText,
  effectiveStrength,
  gistUnitsElapsed,
  reshape,
  semanticize,
} from '@cosimosi/memory-logic'

import { getActiveLocale } from '../../../shared/i18n/index.ts'

// pages/demo model: the whole sandbox, held in ONE piece of page state that dies with the route.
//
// Everything free play does happens here and only here. That is the load-bearing half of [I13]:
// free time travel, no cost gate, an ever-growing launched list and per-memory recall timers are
// all expressible because they are page state — no shared package, feature or entity has a demo
// flag, a demo branch or a bypass to offer, and none of them knows this page exists.
//
// The state stores FACTS and never derived quantities ([I8]'s shape applied to a sandbox): which
// diaries launched, each memory's recall history, seed, current words and gist-timer anchor, and
// the clock. Brightness, decay stage, eroded text, gist stage and the sky's blend are all computed
// downstream by the shipped production functions from exactly these facts.

// The three time grains. Day and week are fixed calendar units — code, not tuning — while the
// month jump is the one tuned scalar the demo owns ([Z2], values.yaml `demo`).
export const DEMO_TIME_JUMPS = {
  day: 1,
  week: 7,
  month: VALUES.demo.timeTravelMonthDays,
} as const

// The taste is one renderer key per decorated surface plus a boolean — no id kept, no ownership, no
// total. A catalog id arrives as `<kind-prefix>.<key>`, and the renderer key is the part after the
// dot, so this page resolves it with `ornamentRendererKey` below rather than importing
// `@cosimosi/store` (whose barrel also carries the pricing functions — and [Z8] is only structural
// while there is no path to them).
//
// `null` on any of them means "as it comes", the row the sheet heads each group with: the taster has
// no revert machine, so the way back to the undecorated look has to be a choosable row and therefore
// a representable state.
export interface DemoTaste {
  readonly background: string | null
  /** Named for what the visitor is shown — the shape a memory takes. The renderer's own word for it
   *  is rendering vocabulary and belongs on the other side of the projection (§3.4). */
  readonly bodyShape: string | null
  /** The shape a memory's SUMMARY takes, once it has risen. Named the same way `bodyShape` is —
   *  for what the visitor is shown, not for the registry the key comes from (§3.4). */
  readonly summaryShape: string | null
  /** One speck of the decorative dust behind everything: what it is drawn as, and its colour. */
  readonly mote: string | null
  /** The space those specks are scattered through: where they sit, how many, how they twinkle. */
  readonly moteField: string | null
  readonly palette: boolean
}

/** The taste fields a decoration group writes — every DemoTaste key except the free palette
 *  toggle, which is not an ornament and has its own control. */
export type DemoTasteOrnament = Exclude<keyof DemoTaste, 'palette'>

/** The renderer key inside a catalog ornament id (`background.soft-aurora` → `soft-aurora`). */
export function ornamentRendererKey(ornamentId: string): string {
  const dot = ornamentId.indexOf('.')
  return dot === -1 ? ornamentId : ornamentId.slice(dot + 1)
}

/** The write flow's draft: a drawn, prepared diary walking entry → split → launch. */
export interface DemoWriting {
  readonly diaryId: string
  readonly splitRevealed: boolean
}

/** One launched memory's stored facts — the demo-local shadow of what the server would own. The
 *  gist-timer anchor lives here because the FE `EpisodicMemory` mirror deliberately has no such
 *  field: adding one for the sandbox's benefit would be a demo field in `packages/memory`. */
export interface DemoMemoryFacts {
  readonly recallCount: number
  readonly lastRecalledUniverseTime: string | null
  readonly seed: bigint
  readonly currentText: string
  /** Travels with `currentText`, because the two only ever change together: the word-loss ladder is
   *  the erosion OF that text, so a reconsolidated reading needs its own. Production stores this
   *  server-side and the next GetUniverse replaces the mirror; the sandbox has neither, so the
   *  fixture's authored ladder would otherwise outlive the text it was authored from. */
  readonly decayStages: readonly string[]
  /** The semanticize reset anchor on the demo clock ([C6a]); a recall re-anchors it. */
  readonly gistTimerResetAt: string
  /** [C7] one-way: a re-anchor delays the next stage but never lowers the reached one. */
  readonly semanticStageFloor: number
}

interface DemoRunState {
  readonly runId: string
  readonly set: DemoDiarySet
  readonly epoch: string
  readonly resolved: ResolvedDemoDiarySet
  readonly writing: DemoWriting | null
  /** Draws taken from the pool so far; the opening diary is draw 0, so this starts at 1. */
  readonly drawCount: number
  /** Which diaries have gone up — a growing list fed by pool draws, never a fixed triple. */
  readonly launchedDiaryIds: readonly string[]
  readonly memoryFacts: Readonly<Record<string, DemoMemoryFacts>>
  /** A plain mutable ISO date. No monotonicity check, no launch precondition, no consent modal and
   *  no diary-date constraint — the demo just passes this down as the `universeTime` the layers
   *  already accept, which is why the exemption needs no shared-code support ([Z2][I10]). */
  readonly clock: string
  readonly skyFilled: boolean
  readonly taste: DemoTaste
}

const NO_TASTE: DemoTaste = {
  background: null,
  bodyShape: null,
  summaryShape: null,
  mote: null,
  moteField: null,
  palette: false,
}

function freshRun(today: string, draw01: number, runId: string): DemoRunState {
  const set = pickDemoDiarySet(DEMO_DIARY_SETS, draw01)
  const epoch = resolveDemoEpoch(today, set)
  // The fixture text is CONTENT, not message keys, so the set is resolved for whichever locale the
  // app is showing — read through the app's i18n seam like every other locale consumer.
  const resolved = resolveDemoDiarySet(set, getActiveLocale(), epoch)
  const firstDiary =
    resolved.diaries.find((diary) => diary.id === set.scenario.firstDiaryId) ?? resolved.diaries[0]
  return {
    runId,
    set,
    epoch,
    resolved,
    // Beat 1: the opening diary arrives already drawn, as the flow's first draft.
    writing: { diaryId: firstDiary.id, splitRevealed: false },
    drawCount: 1,
    launchedDiaryIds: [],
    memoryFacts: {},
    // The clock opens on the first diary's own date, so its memories go up vivid and time has
    // somewhere to travel FROM.
    clock: firstDiary.diaryDate,
    skyFilled: false,
    taste: NO_TASTE,
  }
}

export interface DemoRun {
  readonly state: DemoRunState
  readonly scene: DemoScene
  /** The draft the write flow is walking, resolved for display. */
  readonly writingDiary: Diary | null
  /** Also the replay entry. */
  restart: (today: string, draw01: number, runId: string) => void
  /** Free play's writing verb: draw the next prepared diary from the pool as a fresh draft. */
  drawDiary: () => void
  revealSplit: () => void
  /** Launch the draft: its memories become stored facts and the clock arrives at its date. */
  launchDiary: () => void
  advanceClock: (days: number) => void
  /** Per-memory and repeatable: any launched memory, any number of times ([Z2][Z8] — free). */
  recall: (memoryId: string) => void
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

  const drawDiary = useCallback(
    () =>
      setState((run) => {
        // One draft at a time: while an entry is on screen, another press draws nothing. Without
        // this, a double press during the neuron-reuse beat would advance the pool cursor past the
        // authored second diary — the one whose overlap the beat exists to show.
        if (run.writing) return run
        const diary = pickDemoDiary(demoDiaryPool(run.set), run.drawCount)
        return {
          ...run,
          drawCount: run.drawCount + 1,
          writing: { diaryId: diary.id, splitRevealed: false },
        }
      }),
    [],
  )

  const revealSplit = useCallback(
    () =>
      setState((run) =>
        run.writing ? { ...run, writing: { ...run.writing, splitRevealed: true } } : run,
      ),
    [],
  )

  const launchDiary = useCallback(
    () =>
      setState((run) => {
        if (!run.writing) return run
        const diary = run.resolved.diaries.find((entry) => entry.id === run.writing?.diaryId)
        if (!diary) return { ...run, writing: null }
        // A pool that has cycled can re-draw a launched diary; sending it up again changes nothing.
        if (run.launchedDiaryIds.includes(diary.id)) return { ...run, writing: null }

        // The server's own rule: a launch moves the clock to the diary's date, never backwards.
        const clock = diary.diaryDate > run.clock ? diary.diaryDate : run.clock
        // But a launch is not time the VISITOR pushed. Semanticization must be earned with the
        // time controls — writing a diary and watching a gist body pop reads as a bug, not a
        // mechanic — so every gist anchor rides the launch jump: existing timers shift by the
        // jump, and the launched memories start theirs at the arrived clock (not their created
        // date, which for a cycled past-dated diary can be far behind it).
        const jumpDays = Math.round((Date.parse(clock) - Date.parse(run.clock)) / 86_400_000)
        const memoryFacts: Record<string, DemoMemoryFacts> = {}
        for (const [memoryId, facts] of Object.entries(run.memoryFacts)) {
          memoryFacts[memoryId] =
            jumpDays > 0
              ? { ...facts, gistTimerResetAt: shiftDemoDate(facts.gistTimerResetAt, jumpDays) }
              : facts
        }
        for (const member of diary.memories) {
          const fixture = fixtureMemory(run, member.episodicMemoryId)
          if (!fixture) continue
          memoryFacts[member.episodicMemoryId] = {
            recallCount: 0,
            lastRecalledUniverseTime: null,
            seed: fixture.seed ?? 0n,
            currentText: fixture.currentText,
            // Taken from the fixture rather than recomputed, so the never-recalled path stays
            // byte-identical to the authored ladder instead of merely equal to it.
            decayStages: fixture.decayStages,
            gistTimerResetAt: clock,
            semanticStageFloor: 0,
          }
        }
        return {
          ...run,
          writing: null,
          launchedDiaryIds: [...run.launchedDiaryIds, diary.id],
          memoryFacts,
          clock,
        }
      }),
    [],
  )

  const advanceClock = useCallback(
    (days: number) => setState((run) => ({ ...run, clock: shiftDemoDate(run.clock, days) })),
    [],
  )

  const recall = useCallback(
    (memoryId: string) =>
      setState((run) => {
        const facts = run.memoryFacts[memoryId]
        const fixture = fixtureMemory(run, memoryId)
        if (!facts || !fixture) return run
        // The form changes because the memory came back changed [V5]. Entropy is derived from the run
        // AND the recall count, so every recall reshapes again — and a replay of the same set
        // reshapes the same way ([Z5]).
        const seed = BigInt(reshape(Number(facts.seed), recallEntropy(run, facts.recallCount + 1)))
        const currentText = run.resolved.reconsolidatedTexts[memoryId] ?? facts.currentText
        return {
          ...run,
          memoryFacts: {
            ...run.memoryFacts,
            [memoryId]: {
              // A recall moves stored facts and nothing else. The eroded words come BACK on their
              // own: the last-recall anchor resets the elapsed clock, so `currentDecayText` reads
              // stage 0 again — recovery is a re-render, never a rewrite ([F5][I8]).
              recallCount: facts.recallCount + 1,
              lastRecalledUniverseTime: run.clock,
              seed,
              currentText,
              // The reading that came back is the one that erodes from here on ([I8]). Recomputed on
              // EVERY recall, not just when the words moved: the ladder is a function of the text AND
              // the seed, and the seed reshapes every time — so a memory whose fixture authored no
              // reconsolidated text would otherwise erode by the previous form's pattern, which is
              // the same class of bug one level down. Only a launch keeps the authored strings.
              decayStages: demoDecayLadder(currentText, seed),
              // The gist timer re-anchors; the stage it had reached is kept as the floor ([C7]).
              gistTimerResetAt: run.clock,
              // Deliberately the PRE-recall `facts`: the floor is the stage reached before the
              // re-anchor, which is what [C7] means by "delays the next stage, never lowers the
              // last". Passing the new facts would read the stage back through the reset anchor and
              // floor it at zero.
              semanticStageFloor: derivedSemanticStage(fixture, facts, run.clock),
            },
          },
        }
      }),
    [],
  )

  const fillSky = useCallback(() => setState((run) => ({ ...run, skyFilled: true })), [])

  const taste = useCallback(
    (next: Partial<DemoTaste>) => setState((run) => ({ ...run, taste: { ...run.taste, ...next } })),
    [],
  )

  const scene = useMemo(() => projectScene(state), [state])
  const writingDiary = useMemo(
    () =>
      state.writing
        ? (state.resolved.diaries.find((diary) => diary.id === state.writing?.diaryId) ?? null)
        : null,
    [state.resolved.diaries, state.writing],
  )

  return {
    state,
    scene,
    writingDiary,
    restart,
    drawDiary,
    revealSplit,
    launchDiary,
    advanceClock,
    recall,
    fillSky,
    taste,
  }
}

// The scene the render layers receive: the resolved fixture narrowed to what has been launched,
// with each memory's stored facts applied. Every derived quantity the layers show — brightness,
// size, the eroded text, the gist coordinate, the sky's blend — is computed downstream by the
// shipped functions from exactly these stored facts, which is why free play only ever moves facts.
function projectScene(run: DemoRunState): DemoScene {
  const launched = new Set(run.launchedDiaryIds)
  const launchedMemoryIds = new Set(
    [...run.set.structure.diaries, ...run.set.structure.extraDiaries]
      .filter((diary) => launched.has(diary.id))
      .flatMap((diary) => diary.memories.map((memory) => memory.id)),
  )

  const memories = run.resolved.snapshot.memories
    .filter((memory) => launchedMemoryIds.has(memory.id))
    .map((memory) => applyFacts(memory, run))

  const activeNeuronIds = new Set(
    memories.flatMap((memory) => memory.activations.map((activation) => activation.neuronId)),
  )
  const neurons = run.resolved.snapshot.neurons.filter((neuron) => activeNeuronIds.has(neuron.id))

  // An edge appears only once two neurons have CO-FIRED in a memory that has actually launched —
  // the server's own formation rule, applied to the subset the visitor has sent up. Filtering on
  // "both endpoints exist" instead would be wrong AND would flatten the fourth beat: one diary can
  // easily touch every neuron in a set, so every authored edge would already be drawn before the
  // second diary arrived, and the beat would have nothing to add.
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

function applyFacts(memory: EpisodicMemory, run: DemoRunState): EpisodicMemory {
  const facts = run.memoryFacts[memory.id]
  if (!facts) return memory
  // Every field the run owns is named here rather than spread in, so a fact added to
  // `DemoMemoryFacts` cannot silently keep reading the fixture's value the way `decayStages` did:
  // omitting it from this list is the whole bug, and a list is easier to audit than an absence.
  return {
    ...memory,
    recallCount: facts.recallCount,
    lastRecalledUniverseTime: facts.lastRecalledUniverseTime,
    seed: facts.seed,
    currentText: facts.currentText,
    decayStages: facts.decayStages,
    semanticStage: derivedSemanticStage(memory, facts, run.clock),
  }
}

// The word-loss ladder for a text the visitor has changed, by the shipped erosion function over the
// shipped ratios — the same call the fixtures are authored and pinned with
// (`packages/demo/src/integrity.test.ts`). One entry per ratio, index 0 holding stage 1, which is the
// offset `currentDecayText` reads back.
function demoDecayLadder(currentText: string, seed: bigint): readonly string[] {
  return VALUES.forgetting.stageWordRemovalRatios.map((_ratio, index) =>
    decayStageText(currentText, index + 1, seed),
  )
}

// The gist stage a memory has reached NOW, from its own timer — the production pair `semanticize`
// ∘ `gistUnitsElapsed` over the demo clock, floored by the stage already reached ([C7]: a reset
// delays the next stage, never lowers the last). Per memory, not per scripted id: any memory left
// unrecalled climbs on its own as the visitor pushes time.
function derivedSemanticStage(
  fixture: EpisodicMemory,
  facts: DemoMemoryFacts,
  clock: string,
): number {
  const units = gistUnitsElapsed(
    clock,
    facts.gistTimerResetAt,
    fixture.emotion.arousal,
    effectiveStrength(fixture.baseStrength, facts.recallCount),
  )
  return Math.max(facts.semanticStageFloor, semanticize(0, units))
}

function fixtureMemory(run: DemoRunState, memoryId: string): EpisodicMemory | undefined {
  return run.resolved.snapshot.memories.find((memory) => memory.id === memoryId)
}

// A run-stable, set-stable, recall-indexed entropy: the same set replayed reshapes the same way,
// so the demo stays deterministic under [Z5] while every successive recall still lands on a form
// different from the one before.
function recallEntropy(run: DemoRunState, nthRecall: number): number {
  let hash = 2166136261
  for (const character of run.set.structure.id) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  }
  return hash + nthRecall * 7919
}

// ISO-date arithmetic for the demo clock. Parsed as UTC midnight, so no timezone can move the
// date. Exported so the page can name the interval a jump will cover (for the time-passing
// presentation) without a second date implementation drifting from this one.
export function shiftDemoDate(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * 86_400_000).toISOString().slice(0, 10)
}
