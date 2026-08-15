import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ALTERNATIVE_MOOD_COLORS, MOODS, resetMoodPalette } from '@cosimosi/emotion'
import { applyMoodColors } from '@cosimosi/emotion/react'
import { measureAnchor, type SequenceRect } from '@cosimosi/sequence'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { VALUES } from '@cosimosi/config'
import { resetUniverseUserState, type AdvanceInterval } from '@cosimosi/universe'

import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'
import { shallowEqual, useActorRef, useSelector } from '../../../shared/model/index.ts'
import { DEMO_SCRIPT } from '../model/script.ts'
import {
  demoRunMachine,
  demoRunPhase,
  isDemoAnchorInteractive,
  syncDemoRunMachine,
  tutorialInteractiveAnchors,
} from '../model/run-machine.ts'
import {
  DEMO_TIME_JUMPS,
  shiftDemoDate,
  useDemoRun,
  type DemoTasteOrnament,
} from '../model/use-demo-run.ts'
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
// Two machines run here, one seam between them. The shared sequence engine owns the tour's
// presentation (caption, highlight, dwell, skip chrome); the demo-local run machine owns the run's
// PHASE — tutorial step ↔ free play — and every control's availability derives from it alone.
// `syncDemoRunMachine` in the effect below is the only place they meet.
interface DemoEntry {
  readonly today: string
  readonly draw01: number
  readonly runId: string
}

export function DemoPage({ onSignUp }: { onSignUp: () => void }) {
  // The reset control re-keys the whole run: a remount rebuilds both machines and redraws the set
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
  // that also sets state (the re-measure below) becomes an update loop.
  const phase = useSelector(runActor, (snapshot) => demoRunPhase(snapshot.value), shallowEqual)

  // The engine advances on the visitor's signals; the phase machine follows it here — completion
  // and skip both land it in free play, permanently.
  const engineStepIndex = run.progress.current - 1
  const engineOutcome = run.outcome
  useEffect(() => {
    syncDemoRunMachine(runActor, { stepIndex: engineStepIndex, outcome: engineOutcome })
  }, [engineOutcome, engineStepIndex, runActor])

  // The write flow rides the product's dialog. Open is PAGE state (the machine owns pressability,
  // not visibility): the sheet opens with a draft and closes on launch; dismissing it early is
  // possible only when the write control could reopen it, so a tutorial beat staged inside the
  // sheet cannot be stranded — its close is simply inert until then.
  const [sheetOpen, setSheetOpen] = useState(true)

  // The surfaces a picked star opens, all page state for the same reason: which star is selected,
  // whether its recall walk is up (and whether it has been applied), and which diary is being read.
  // Only ONE of them is ever on screen — each opens by closing the one it came from, because two
  // surfaces that both declare themselves modal would stack two scrims and two focus traps.
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const [recallMemoryId, setRecallMemoryId] = useState<string | null>(null)
  const [recallApplied, setRecallApplied] = useState(false)
  const [readingDiaryId, setReadingDiaryId] = useState<string | null>(null)

  // 꾸미기 opens the product-shaped decoration sheet. `decorateTasted` is what makes the decorating
  // beat a round trip rather than one press: until something has been tried on, the sheet's way out
  // is inert, and the beat ends when the visitor comes back out to the changed universe.
  const [decorateOpen, setDecorateOpen] = useState(false)
  const [decorateTasted, setDecorateTasted] = useState(false)

  // The chrome's layout moves when the phase, the draft or the sheet does — the split rows appear,
  // the dialog mounts, launched rows arrive — and the engine cannot see any of that (a registry
  // change is its only signal). Re-measure after those commits, or the ring keeps pointing at the
  // current control's stale position.
  const remeasure = run.remeasure
  const starCount = demo.scene.memories.length
  const writingState = demo.state.writing
  // Keyed on primitives only: an object dep that changed identity per render would turn this
  // effect's own state write (the measure token) into an infinite update loop.
  const phaseKey = phase.kind === 'tutorial' ? phase.beatId : 'freePlay'
  useEffect(() => {
    remeasure()
  }, [
    decorateOpen,
    phaseKey,
    readingDiaryId,
    recallMemoryId,
    remeasure,
    selectedMemoryId,
    sheetOpen,
    starCount,
    writingState,
  ])

  // The mask's hole: the union box of every control the current beat opens — one lit region cut
  // out of one covering layer. Measured page-side through the same anchor registry the engine
  // reads; `run.anchorRect` doubles as the "layout settled / window resized" signal, since the
  // engine re-measures on both. No hole (the sky beat, an unmeasured mount, free play) means no
  // mask — a blackout with nothing lit would say "wait", and no beat here means that.
  const [maskHole, setMaskHole] = useState<SequenceRect | null>(null)
  const engineRect = run.anchorRect
  useEffect(() => {
    if (phaseKey === 'freePlay') {
      setMaskHole(null)
      return
    }
    const anchors = tutorialInteractiveAnchors(phaseKey)
    if (!anchors || anchors.length === 0) {
      setMaskHole(null)
      return
    }
    let live = true
    void Promise.all(anchors.map((anchor) => measureAnchor(anchor))).then((rects) => {
      if (!live) return
      const boxes = rects.filter((rect): rect is SequenceRect => rect !== null)
      setMaskHole(boxes.length > 0 ? unionSequenceRects(boxes) : null)
    })
    return () => {
      live = false
    }
  }, [
    decorateOpen,
    engineRect,
    phaseKey,
    recallMemoryId,
    selectedMemoryId,
    sheetOpen,
    starCount,
    writingState,
  ])

  // Two beats do their work across a surface the first press OPENS, so their ring walks with the
  // visitor instead of staying parked on a button already pressed. The engine's own anchor stays
  // what the script says; this is a page-side view override, measured through the same registry.
  // `none` is a deliberate third state: the last leg of the decorating beat is "come back out", and
  // the way out is the sheet's own close — a control the shared primitive owns, which this page
  // cannot wrap in an anchor and must not learn about. So the ring stands down and the caption,
  // which the engine guarantees, carries that leg alone.
  const [ringOverride, setRingOverride] = useState<
    { readonly kind: 'rect'; readonly rect: SequenceRect | null } | { readonly kind: 'none' } | null
  >(null)
  useEffect(() => {
    // The neuron-reuse beat: drawing is only its first press — 쪼개기 and 띄우기 finish the diary.
    if (phaseKey === 'neuron_reuse' && writingState && sheetOpen) {
      const target = writingState.splitRevealed ? 'launch-action' : 'split-action'
      let live = true
      void measureAnchor(target).then((rect) => {
        if (live) setRingOverride({ kind: 'rect', rect })
      })
      return () => {
        live = false
      }
    }
    // The decorating beat: into the sheet, onto a row, then out of the way for the trip back.
    if (phaseKey === 'ornament_taster' && decorateOpen) {
      if (decorateTasted) {
        setRingOverride({ kind: 'none' })
        return
      }
      let live = true
      void measureAnchor('ornament-row-action').then((rect) => {
        if (live) setRingOverride({ kind: 'rect', rect })
      })
      return () => {
        live = false
      }
    }
    setRingOverride(null)
  }, [decorateOpen, decorateTasted, engineRect, phaseKey, sheetOpen, writingState])
  const guideAnchorRect = ringOverride
    ? ringOverride.kind === 'rect'
      ? ringOverride.rect
      : null
    : run.anchorRect

  // The covering yields to the scene when the scene IS the point: a launch and a time sweep both
  // play out on the covered canvas, so the whole layer fades out for their duration plus a linger,
  // then returns. Pressability never changes with it — the lift is the mask's business only.
  const [maskLifted, setMaskLifted] = useState(false)
  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdMaskLift = useCallback(() => {
    if (liftTimerRef.current) clearTimeout(liftTimerRef.current)
    liftTimerRef.current = null
    setMaskLifted(true)
  }, [])
  const releaseMaskLift = useCallback(() => {
    if (liftTimerRef.current) clearTimeout(liftTimerRef.current)
    liftTimerRef.current = setTimeout(() => setMaskLifted(false), VALUES.demo.maskLiftLingerMs)
  }, [])
  useEffect(
    () => () => {
      if (liftTimerRef.current) clearTimeout(liftTimerRef.current)
    },
    [],
  )

  // Entering starts the tour EVERY time, and a second mount in the same tab replays the awaken:
  // `useAwakenRegistryStore` is a module-level idempotency registry that survives remounts, so
  // without this reset a replay would silently skip the birth choreography it exists to show.
  // `startRun` and the entry are both stable for the life of the mount, so this runs once per entry.
  useEffect(() => {
    resetUniverseUserState()
    startRun(entry.runId)
  }, [entry.runId, startRun])

  // Nothing carries over. Both stores are module-level and outlive the route, so a tasted palette
  // would otherwise bleed into the landing page or the next session's first paint.
  useEffect(
    () => () => {
      resetUniverseUserState()
      resetMoodPalette()
    },
    [],
  )

  const { state, scene, writingDiary } = demo
  const signal = run.signal

  // The time-passing presentation: a jump commits the clock immediately (the data path never waits
  // on presentation), then the sweep walks the DISPLAYED date previous → current so the stars dim
  // in front of the viewer — the product's own sequencing, rendered demo-locally.
  const [sweep, setSweep] = useState<AdvanceInterval | null>(null)
  const [sweepTime, setSweepTime] = useState<string | null>(null)
  const playSweep = useCallback(
    (previous: string, current: string) => {
      if (current <= previous) return
      holdMaskLift()
      // The displayed clock starts at `previous` in the SAME commit the sweep begins, or the first
      // frame would flash the committed final date before the rAF loop walks back and forward.
      setSweepTime(previous)
      setSweep({ previous, current })
    },
    [holdMaskLift],
  )
  const onSweepDone = useCallback(() => {
    setSweep(null)
    setSweepTime(null)
    releaseMaskLift()
  }, [releaseMaskLift])

  const onDiaryRead = useCallback(() => signal('diary_read'), [signal])

  const onDraw = useCallback(() => {
    // With a draft already on screen the draw is a no-op in the model, so this press only brings
    // the sheet back — the reopen path for a dismissed dialog.
    demo.drawDiary()
    setSheetOpen(true)
  }, [demo])

  const onRevealSplit = useCallback(() => {
    demo.revealSplit()
    signal('split_revealed')
  }, [demo, signal])

  const onLaunch = useCallback(() => {
    // A launch arrives the way the product's does: the sheet closes, the memories go up, and when
    // the clock jump is real the same passing-time presentation plays. A re-drawn diary that has
    // already launched goes up as a no-op — reporting `launched` for it would advance a tutorial
    // beat past work that put nothing new in the sky.
    const draft = demo.writingDiary
    const launches = !!draft && !demo.state.launchedDiaryIds.includes(draft.id)
    const previous = demo.state.clock
    demo.launchDiary()
    setSheetOpen(false)
    if (!launches || !draft) return
    if (draft.diaryDate > previous) {
      playSweep(previous, draft.diaryDate)
    } else {
      // No clock jump still births a memory on the canvas — lift the covering for the awaken.
      holdMaskLift()
      releaseMaskLift()
    }
    signal('launched')
  }, [demo, holdMaskLift, playSweep, releaseMaskLift, signal])

  const onSheetClose = useCallback(() => {
    if (!isDemoAnchorInteractive(phase, 'write-action')) return
    setSheetOpen(false)
  }, [phase])

  const onAdvanceDays = useCallback(
    (grain: 'day' | 'week' | 'month') => {
      const days = DEMO_TIME_JUMPS[grain]
      const previous = demo.state.clock
      demo.advanceClock(days)
      playSweep(previous, shiftDemoDate(previous, days))
      // Both outcomes of pushing time are reported; the engine keeps whichever its current beat
      // waits for and drops the other — beat 5 hears the advance, beat 7 hears the rise.
      signal('time_advanced')
      signal('gist_risen')
    },
    [demo, playSweep, signal],
  )

  // 회고하기 walks the product's own three steps — the star's panel hands the memory to the recall
  // surface, the confirm applies it, and the result is read before the room comes back. The beat is
  // reported on the way OUT, not on the confirm: the reshaped, re-brightened star is the point, and
  // it plays on a canvas the result surface is standing on. So the covering lifts as the flow closes
  // and the next caption arrives with it, exactly as a launch does.
  const onRecallRequested = useCallback((memoryId: string) => {
    setSelectedMemoryId(null)
    setRecallApplied(false)
    setRecallMemoryId(memoryId)
  }, [])

  const onRecallConfirm = useCallback(() => {
    if (!recallMemoryId || recallApplied) return
    demo.recall(recallMemoryId)
    setRecallApplied(true)
  }, [demo, recallApplied, recallMemoryId])

  const onRecallClose = useCallback(() => {
    const applied = recallApplied
    setRecallMemoryId(null)
    setRecallApplied(false)
    if (!applied) return
    holdMaskLift()
    releaseMaskLift()
    signal('recalled')
  }, [holdMaskLift, recallApplied, releaseMaskLift, signal])

  // Beat 8 is a consequence rather than an action: once the universe holds enough re-read emotion,
  // the sky takes its colour. The page applies it and then reports, so the caption never runs ahead.
  const stepId = run.step?.id
  useEffect(() => {
    if (stepId !== 'color' || state.skyFilled) return
    demo.fillSky()
    signal('sky_filled')
  }, [demo, signal, state.skyFilled, stepId])

  // A tried-on ornament applies at once — a selection simply IS the sky now ([Z8] discharged by
  // absence: no preview, no save, no total). Nothing is reported here: what finishes the decorating
  // beat is the trip back out to the universe, which is where the change is actually seen.
  const onApplyOrnament = useCallback(
    (surface: DemoTasteOrnament, rendererKey: string | null) => {
      demo.taste({ [surface]: rendererKey })
      setDecorateTasted(true)
    },
    [demo],
  )
  const onApplyPalette = useCallback(
    (on: boolean) => {
      // The one palette write that reaches no server: `applyMoodColors` stamps the module-level
      // palette the render seam already reads. The `AccountService`-calling writes are banned by
      // name in the demo's import block, so a colour cannot be saved from here even by accident.
      if (on) applyMoodColors(MOODS.map((mood) => ({ mood, color: ALTERNATIVE_MOOD_COLORS[mood] })))
      else resetMoodPalette()
      demo.taste({ palette: on })
      setDecorateTasted(true)
    },
    [demo],
  )

  const onCloseDecoration = useCallback(() => {
    setDecorateOpen(false)
    signal('decorate_closed')
  }, [signal])

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
      setSelectedMemoryId(memoryId)
    },
    [phase, tutorialRecallMemoryId],
  )

  // The recall beat opens with its star already picked. The beat's WORK stays the visitor's — the
  // recall is theirs to press ([O2]) — but which star it is about is the scenario's, and asking a
  // visitor to find it among a cluster of look-alikes is a search task the caption cannot help with.
  // The writing sheet arrives the same way, already open on beat 1.
  useEffect(() => {
    if (phaseKey !== 'recall' || recallMemoryId) return
    setSelectedMemoryId((current) => current ?? tutorialRecallMemoryId)
  }, [phaseKey, recallMemoryId, tutorialRecallMemoryId])

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
    setSelectedMemoryId(null)
    setReadingDiaryId(diary.id)
  }, [diaries, selectedMemoryId])

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
        onOpenDecoration={() => setDecorateOpen(true)}
        onSignUp={onSignUp}
        onReset={onReset}
      />

      {/* A picked star, and the two surfaces it hands off to. Each opens by closing the one before
          it, so the canvas is never under two scrims at once. */}
      <DemoStarPanel
        memory={selectedMemory}
        phase={phase}
        universeTime={displayTime}
        bodyShape={state.taste.bodyShape}
        isRecallTarget={selectedMemoryId === tutorialRecallMemoryId}
        onRecall={() => selectedMemoryId && onRecallRequested(selectedMemoryId)}
        onOpenDiary={onOpenDiary}
        onClose={() => setSelectedMemoryId(null)}
      />
      <DemoRecallSheet
        open={!!recallMemoryId}
        memory={recallMemory}
        universeTime={displayTime}
        reconsolidatedText={
          recallMemoryId ? (state.resolved.reconsolidatedTexts[recallMemoryId] ?? null) : null
        }
        done={recallApplied}
        onConfirm={onRecallConfirm}
        onClose={onRecallClose}
      />
      <DemoEntryReader diary={readingDiary} onClose={() => setReadingDiaryId(null)} />

      <DemoDecorationSheet
        open={decorateOpen}
        phase={phase}
        taste={state.taste}
        canClose={phaseKey !== 'ornament_taster' || decorateTasted}
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
          (ring, caption, skip) paints above it on `z-guide`, and the launch/sweep moments lift it. */}
      <DemoTutorialMask hole={maskHole} lifted={maskLifted} />

      <SequenceGuide
        active={run.active}
        // While the mask is lifted the SCENE is speaking — a launch bursting, a sweep dimming the
        // field — so the next beat's line and ring hold back and arrive together with the
        // covering's return. The skip stays; it must never blink out.
        caption={maskLifted ? null : (run.step?.caption ?? null)}
        anchorRect={maskLifted ? null : guideAnchorRect}
        progress={run.progress}
        onSkip={run.skip}
        onRemeasure={run.remeasure}
        // How the line should sit on a NARROW screen, where every surface here comes up from the
        // bottom edge (from `md` up the guide puts it in the bottom band regardless, because the
        // surfaces centre and the edge is free). The write flow is the one surface whose steps point
        // at its own fields in sequence, so its line glues to the highlighted control; every other
        // open surface — the star's panel, the recall walk, a diary, the catalog — takes the top
        // band, clear of the sheet it would otherwise lie across. With nothing open the line floats
        // in the eyeline.
        captionStyle={
          sheetOpen && writing
            ? 'attached'
            : decorateOpen || selectedMemoryId || recallMemoryId || readingDiaryId
              ? 'top'
              : 'center'
        }
      />
    </main>
  )
}

// The union box of every measured rect — the mask's lit region when a beat opens a control cluster.
function unionSequenceRects(rects: readonly SequenceRect[]): SequenceRect {
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}
