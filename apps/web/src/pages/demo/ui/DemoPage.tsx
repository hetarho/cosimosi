import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ALTERNATIVE_MOOD_COLORS, MOODS, resetMoodPalette } from '@cosimosi/emotion'
import { applyMoodColors } from '@cosimosi/emotion/react'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { VALUES } from '@cosimosi/config'

import { shallowEqual, useActorRef, useSelector } from '@cosimosi/state-machine/react'
import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'
import type { DemoSignal } from '../model/anchors.ts'
import { DEMO_SCRIPT } from '../model/script.ts'
import {
  demoRunMachine,
  demoRunPhase,
  isDemoAnchorInteractive,
  syncDemoRunMachine,
} from '../model/run-machine.ts'
import { useTutorialRecallPanelSelection } from '../model/recall-panel.ts'
import {
  DEMO_TIME_JUMPS,
  shiftDemoDate,
  useDemoRun,
  type DemoTasteOrnament,
} from '../model/use-demo-run.ts'
import { useDemoGuide } from '../model/use-demo-guide.ts'
import { useDemoSandbox } from '../model/use-demo-sandbox.ts'
import { useDemoSurface } from '../model/use-demo-surface.ts'
import { useScenePresentation } from '../model/use-scene-presentation.ts'
import { DemoDecorationSheet } from './DemoDecorationSheet.tsx'
import { DemoEntryReader } from './DemoEntryReader.tsx'
import { DemoHud } from './DemoHud.tsx'
import { DemoRecallSheet } from './DemoRecallSheet.tsx'
import { DemoStarPanel } from './DemoStarPanel.tsx'
import { DemoTutorialMask } from './DemoTutorialMask.tsx'
import { DemoTimeAdvance } from './DemoTimePassing.tsx'
import { DemoUniverseScene } from './DemoUniverseScene.tsx'
import { DemoWritingSheet, type DemoProposedMemory } from './DemoWritingSheet.tsx'

// pages/demo: the public playroom with a tutorial in front of it. It composes `packages/*`
// directly rather than reaching for the product widgets — the shipped canvas widget's
// `useUniverse()` throws without a session, and the demo has none. It issues no RPC, writes no row
// and calls no model, and the demo-scoped import block in the ESLint config is what makes that a
// closure rather than a promise: with no transport reachable, a server call is not expressible.
//
// Three machines run here. The shared sequence engine owns the tour's presentation (caption,
// highlight, dwell, skip chrome); the demo-local run machine owns the run's PHASE — tutorial step ↔
// free play — and every control's availability derives from it alone; the surface machine owns
// which ONE surface is open. `syncDemoRunMachine` in the effect below is the only place the first
// two meet. What remains in this component is composition: reading those, handing presses to them.

/** What a time jump reports once its months have run past on screen. */
const TIME_JUMP_REPORTS: readonly DemoSignal[] = ['time_advanced', 'gist_risen']

interface DemoEntry {
  readonly today: string
  readonly draw01: number
  readonly runId: string
}

export function DemoPage({ onSignUp }: { onSignUp: () => void }) {
  // The reset control re-keys the whole run: a remount rebuilds every machine and redraws the set
  // exactly the way a fresh visit would, and the unmount cleanup below clears the module-level
  // stores on the way — one code path for "start over" and "arrive", so they cannot drift.
  const [runSeed, setRunSeed] = useState(0)
  return (
    <DemoRun key={runSeed} onSignUp={onSignUp} onReset={() => setRunSeed((seed) => seed + 1)} />
  )
}

function DemoRun({ onSignUp, onReset }: { onSignUp: () => void; onReset: () => void }) {
  // A run's identity and its drawn set are decided once per entry. `Math.random()` lives HERE, at the
  // boundary — the fixture package takes the draw as a parameter, which is what makes the split
  // deterministic while still varying which set a visitor meets.
  const entryRef = useRef<DemoEntry | null>(null)
  const entry = (entryRef.current ??= {
    today: new Date().toISOString().slice(0, 10),
    draw01: Math.random(),
    runId: `demo-${Date.now()}`,
  })

  const demo = useDemoRun(entry)
  const run = useSequenceRun(DEMO_SCRIPT, { captionDwellMs: VALUES.sequence.captionDwellMs })
  const startRun = run.start

  const runActor = useActorRef(demoRunMachine)
  // The selector builds a fresh object per read, so it MUST compare shallowly — with the default
  // identity compare every subscription check reads as a change, and any effect keyed on `phase`
  // that also sets state (the re-measure) becomes an update loop.
  const phase = useSelector(runActor, (snapshot) => demoRunPhase(snapshot.value), shallowEqual)

  // The engine advances on the visitor's signals; the phase machine follows it here — completion
  // and skip both land it in free play, permanently.
  const engineStepIndex = run.progress.current - 1
  const engineOutcome = run.outcome
  useEffect(() => {
    syncDemoRunMachine(runActor, { stepIndex: engineStepIndex, outcome: engineOutcome })
  }, [engineOutcome, engineStepIndex, runActor])

  // The write flow, a picked memory's panel, the recall walk, the diary reader and the decoration
  // sheet: one machine state, so only one of them is ever on screen. Visibility is page state — the
  // run machine owns pressability, not visibility.
  const {
    actor: surfaceActor,
    surface,
    tasted,
    sheetOpen,
    selectedMemoryId,
    recallMemoryId,
    recallApplied,
    readingDiaryId,
    decorateOpen,
  } = useDemoSurface()
  const send = surfaceActor.send

  const phaseKey = phase.kind === 'tutorial' ? phase.beatId : 'freePlay'
  const writingState = demo.state.writing
  const { maskHole, guideAnchorRect } = useDemoGuide({
    beat: phaseKey,
    surface,
    tasted,
    splitRevealed: writingState ? writingState.splitRevealed : null,
    memoryCount: demo.scene.memories.length,
    engineRect: run.anchorRect,
    remeasure: run.remeasure,
  })

  const signal = run.signal
  const {
    sceneRevealing,
    openReveal,
    closeReveal,
    sweep,
    sweepTime,
    setSweepTime,
    playSweep,
    onSweepDone,
  } = useScenePresentation(signal)

  useDemoSandbox(entry.runId, startRun)

  const { state, scene, writingDiary } = demo

  const onDiaryRead = useCallback(() => signal('diary_read'), [signal])

  const onDraw = useCallback(() => {
    // With a draft already on screen the draw is a no-op in the model, so this press only brings
    // the sheet back — the reopen path for a dismissed dialog.
    demo.drawDiary()
    send({ type: 'OPEN_WRITING' })
  }, [demo, send])

  const onRevealSplit = useCallback(() => {
    demo.revealSplit()
    signal('split_revealed')
  }, [demo, signal])

  const onLaunch = useCallback(() => {
    // A launch arrives the way the product's does: the sheet closes, the memories go up, and when
    // the clock jump is real the same passing-time presentation plays. A re-drawn diary that has
    // already launched goes up as a no-op — reporting `launched` for it would advance a tutorial
    // beat past work that put nothing new in the sky.
    //
    // `launched` is reported from the press rather than handed to the sweep, because a launch has a
    // second path with no sweep to land on, and every beat it hands to waits on a press of its own —
    // their line arrives with the settled scene either way.
    const draft = demo.writingDiary
    const launches = !!draft && !demo.state.launchedDiaryIds.includes(draft.id)
    const previous = demo.state.clock
    demo.launchDiary()
    send({ type: 'CLOSE_WRITING' })
    if (!launches || !draft) return
    if (draft.diaryDate > previous) {
      playSweep(previous, draft.diaryDate)
    } else {
      // No clock jump still births a memory on the canvas — lift the covering for the awaken, which
      // is then the only thing playing and gets the full hold.
      openReveal()
      closeReveal(VALUES.demo.revealHoldMs)
    }
    signal('launched')
  }, [closeReveal, demo, openReveal, playSweep, send, signal])

  // Dismissing the sheet early is possible only when the write control could reopen it, so a
  // tutorial beat staged inside the sheet cannot be stranded — its close is simply inert until then.
  const onSheetClose = useCallback(() => {
    if (!isDemoAnchorInteractive(phase, 'write-action')) return
    send({ type: 'CLOSE_WRITING' })
  }, [phase, send])

  const onAdvanceDays = useCallback(
    (grain: 'day' | 'week' | 'month') => {
      const days = DEMO_TIME_JUMPS[grain]
      const previous = demo.state.clock
      demo.advanceClock(days)
      // Both outcomes of pushing time are handed to the sweep, which reports them once the months
      // have actually run past; the engine keeps whichever its current beat waits for and drops the
      // other — beat 5 hears the advance, beat 7 hears the rise.
      playSweep(previous, shiftDemoDate(previous, days), TIME_JUMP_REPORTS)
    },
    [demo, playSweep],
  )

  // 회고하기 walks the product's own three steps — the star's panel hands the memory to the recall
  // surface, the confirm applies it, and the result is read before the room comes back. The beat is
  // reported on the way OUT, not on the confirm: the reshaped, re-brightened star is the point, and
  // it plays on a canvas the result surface is standing on. So the covering lifts as the flow closes
  // and the next caption arrives with it, exactly as a launch does.
  const onRecallRequested = useCallback(
    (memoryId: string) => send({ type: 'REQUEST_RECALL', memoryId }),
    [send],
  )

  const onRecallConfirm = useCallback(() => {
    if (!recallMemoryId || recallApplied) return
    // The sentence lands on the canvas at once — the memory brightens and reshapes where it stands —
    // so the surface that asked for it steps DOWN for the reveal and comes back up with the result.
    // Watching your own memory come back through the sheet you sent it from shows nothing.
    demo.recall(recallMemoryId)
    send({ type: 'RECALL_APPLIED' })
    openReveal()
    closeReveal(VALUES.demo.revealHoldMs)
  }, [closeReveal, demo, openReveal, recallApplied, recallMemoryId, send])

  const onRecallClose = useCallback(() => {
    const applied = recallApplied
    send({ type: 'CLOSE_RECALL' })
    // Only a walk that actually sent something back finishes the beat; dismissing it early leaves the
    // beat where it was, and the staging below puts its panel up again.
    if (applied) signal('recalled')
  }, [recallApplied, send, signal])

  // A tried-on ornament applies at once — a selection simply IS the sky now ([Z8] discharged by
  // absence: no preview, no save, no total). Nothing is reported here: what finishes the decorating
  // beat is the trip back out to the universe, which is where the change is actually seen.
  const onApplyOrnament = useCallback(
    (ornament: DemoTasteOrnament, rendererKey: string | null) => {
      demo.taste({ [ornament]: rendererKey })
      send({ type: 'TASTED' })
    },
    [demo, send],
  )
  const onApplyPalette = useCallback(
    (on: boolean) => {
      // The one palette write that reaches no server: `applyMoodColors` stamps the module-level
      // palette the render seam already reads. The `AccountService`-calling writes are banned by
      // name in the demo's import block, so a colour cannot be saved from here even by accident.
      if (on) applyMoodColors(MOODS.map((mood) => ({ mood, color: ALTERNATIVE_MOOD_COLORS[mood] })))
      else resetMoodPalette()
      demo.taste({ palette: on })
      send({ type: 'TASTED' })
    },
    [demo, send],
  )

  const onCloseDecoration = useCallback(() => {
    send({ type: 'CLOSE_DECORATION' })
    signal('decorate_closed')
  }, [send, signal])

  // The drawn diary through the product's review shapes: each proposed memory carries the name and
  // mood the split decided, the diary passage it was encoded from (its stage-0 words) and the
  // neurons it hangs from — read off the resolved fixture, never computed here.
  const writing = useMemo(() => {
    if (!state.writing || !writingDiary) return null
    const neuronName = (neuronId: string) =>
      state.resolved.snapshot.neurons.find((neuron) => neuron.id === neuronId)?.name ?? ''
    const memories: DemoProposedMemory[] = writingDiary.memories.map((member) => {
      const fixture = state.resolved.snapshot.memories.find(
        (memory) => memory.id === member.episodicMemoryId,
      )
      return {
        id: member.episodicMemoryId,
        name: member.name,
        mood: member.mood,
        sourceText: fixture?.currentText ?? '',
        neurons: (fixture?.activations ?? [])
          .map((activation) => ({ name: neuronName(activation.neuronId) }))
          .filter((neuron) => neuron.name !== ''),
      }
    })
    return {
      body: writingDiary.body,
      diaryDate: writingDiary.diaryDate,
      splitRevealed: state.writing.splitRevealed,
      memories,
    }
  }, [state.resolved.snapshot, state.writing, writingDiary])

  // A star picked on the canvas opens its panel — the product's own way in ([D1]), and now the
  // demo's only one. During the tutorial a pick lands only where the current beat is: the recall
  // beat's own star. Reading and recalling are gated inside the panel by the same derivation, so a
  // beat can never be pressed forward from a star it is not about.
  const tutorialRecallMemoryId = state.set.scenario.recallMemoryId
  const onSelectMemory = useCallback(
    (memoryId: string) => {
      const isTarget = memoryId === tutorialRecallMemoryId
      if (
        phase.kind === 'tutorial' &&
        !isDemoAnchorInteractive(phase, 'recall-action', isTarget) &&
        !isDemoAnchorInteractive(phase, 'entry-open-action')
      )
        return
      send({ type: 'SELECT_MEMORY', memoryId })
    },
    [phase, send, tutorialRecallMemoryId],
  )

  // The recall beat opens with its star already picked. The beat's WORK stays the visitor's — the
  // recall is theirs to press ([O2]) — but which star it is about is the scenario's, and asking a
  // visitor to find it among a cluster of look-alikes is a search task the caption cannot help with.
  // If the staged panel is dismissed before that work starts, selection is re-armed immediately;
  // otherwise the mask would be left pointing at a control that no longer exists.
  // The staging is wanted while the beat still has work to do and the scene is not mid-reveal. The
  // second half is read off the DOMAIN fact rather than a flag: a memory that has been returned to
  // needs no panel opened over it, so the staging cannot put the dismissed panel back on the way out.
  const stagingWanted =
    !sceneRevealing && (state.memoryFacts[tutorialRecallMemoryId]?.recallCount ?? 0) === 0
  const stageStar = useCallback(
    (memoryId: string | null) =>
      send(memoryId ? { type: 'SELECT_MEMORY', memoryId } : { type: 'CLOSE_MEMORY' }),
    [send],
  )
  useTutorialRecallPanelSelection(
    phaseKey,
    selectedMemoryId,
    recallMemoryId,
    tutorialRecallMemoryId,
    stagingWanted,
    stageStar,
  )

  const findMemory = (memoryId: string | null) =>
    memoryId ? (scene.memories.find((memory) => memory.id === memoryId) ?? null) : null

  const selectedMemory = findMemory(selectedMemoryId)
  const recallMemory = findMemory(recallMemoryId)
  const readingDiary = readingDiaryId
    ? (state.resolved.diaries.find((diary) => diary.id === readingDiaryId) ?? null)
    : null

  // 원본 일기 보기 — the star names the diary it was split from, so the reader opens that one ([D2]'s
  // shape without the archive route the sandbox does not have).
  const diaries = state.resolved.diaries
  const onOpenDiary = useCallback(() => {
    const diary = diaries.find((entry) =>
      entry.memories.some((member) => member.episodicMemoryId === selectedMemoryId),
    )
    if (!diary) return
    send({ type: 'OPEN_DIARY', diaryId: diary.id })
  }, [diaries, selectedMemoryId, send])

  const displayTime = sweepTime ?? scene.universeTime

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-text">
      <DemoUniverseScene
        scene={scene}
        taste={state.taste}
        displayTime={displayTime}
        cameraFree={phase.kind === 'freePlay'}
        onSelectMemory={onSelectMemory}
      />

      {sweep && <DemoTimeAdvance interval={sweep} onTick={setSweepTime} onDone={onSweepDone} />}

      {/* The HUD in the home screen's own arrangement — one layer, one DOM order, no breakpoint
          duplicating a control, so no anchor id ever registers twice. */}
      <DemoHud
        phase={phase}
        displayTime={displayTime}
        onDraw={onDraw}
        onAdvanceDays={onAdvanceDays}
        onOpenDecoration={() => send({ type: 'OPEN_DECORATION' })}
        onSignUp={onSignUp}
        onReset={onReset}
      />

      {/* A picked star, and the two surfaces it hands off to — states of one machine, so the canvas
          is never under two scrims at once. */}
      <DemoStarPanel
        memory={selectedMemory}
        phase={phase}
        universeTime={displayTime}
        bodyShape={state.taste.bodyShape}
        isRecallTarget={selectedMemoryId === tutorialRecallMemoryId}
        onRecall={() => selectedMemoryId && onRecallRequested(selectedMemoryId)}
        onOpenDiary={onOpenDiary}
        onClose={() => send({ type: 'CLOSE_MEMORY' })}
      />
      <DemoRecallSheet
        // Down while the scene speaks, up again for the reading that came back.
        open={!!recallMemoryId && !sceneRevealing}
        memory={recallMemory}
        universeTime={displayTime}
        reconsolidatedText={
          recallMemoryId ? (state.resolved.reconsolidatedTexts[recallMemoryId] ?? null) : null
        }
        done={recallApplied}
        onConfirm={onRecallConfirm}
        onClose={onRecallClose}
      />
      <DemoEntryReader diary={readingDiary} onClose={() => send({ type: 'CLOSE_DIARY' })} />

      <DemoDecorationSheet
        open={decorateOpen}
        phase={phase}
        taste={state.taste}
        canClose={phaseKey !== 'ornament_taster' || tasted}
        onApplyOrnament={onApplyOrnament}
        onApplyPalette={onApplyPalette}
        onClose={onCloseDecoration}
      />

      {writing && (
        <DemoWritingSheet
          open={sheetOpen}
          phase={phase}
          body={writing.body}
          diaryDate={writing.diaryDate}
          splitRevealed={writing.splitRevealed}
          memories={writing.memories}
          showReadAffordance={phaseKey === 'diary_appears'}
          onDiaryRead={onDiaryRead}
          onRevealSplit={onRevealSplit}
          onLaunch={onLaunch}
          onClose={onSheetClose}
        />
      )}

      {/* One covering layer over everything but the current beat's controls; the sequence chrome
          (ring, caption, skip) paints above it on `z-guide`, and the scene's own moments lift it. */}
      <DemoTutorialMask hole={maskHole} lifted={sceneRevealing} />

      {/* Nothing here says where the line goes: the guide reads the screen itself, so a sheet this
          page opens and a sheet it has never heard of are cleared by the same rule. */}
      <SequenceGuide
        active={run.active}
        // While the scene is revealing it is SPEAKING — a launch bursting, a sweep dimming the field
        // — so the next beat's line and ring hold back and arrive together with the covering's
        // return. The skip stays; it must never blink out.
        caption={sceneRevealing ? null : (run.step?.caption ?? null)}
        anchorRect={sceneRevealing ? null : guideAnchorRect}
        progress={run.progress}
        onSkip={run.skip}
        onRemeasure={run.remeasure}
      />
    </main>
  )
}
