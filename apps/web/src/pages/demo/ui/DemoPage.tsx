import { useCallback, useEffect, useMemo, useRef } from 'react'

import { ALTERNATIVE_MOOD_COLORS, MOODS, resetMoodPalette } from '@cosimosi/emotion'
import { applyMoodColors } from '@cosimosi/emotion/react'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { VALUES } from '@cosimosi/config'
import { resetUniverseUserState } from '@cosimosi/universe'

import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import type { DemoSignal } from '../model/anchors.ts'
import { DEMO_SCRIPT } from '../model/script.ts'
import { ornamentRendererKey, useDemoRun } from '../model/use-demo-run.ts'
import { DemoControlRail } from './DemoControlRail.tsx'
import { DemoTasterRail } from './DemoTasterRail.tsx'
import { DemoUniverseScene } from './DemoUniverseScene.tsx'

// pages/demo: the public trailer. It composes `packages/*` directly rather than reaching for the
// product widgets — the shipped canvas widget's `useUniverse()` throws without a session, and the
// demo has none. It issues no RPC, writes no row and calls no model, and the demo-scoped import block
// in the ESLint config is what makes that a closure rather than a promise: with no transport
// reachable, a server call is not expressible here.
interface DemoEntry {
  readonly today: string
  readonly draw01: number
  readonly runId: string
}

export function DemoPage({ onSignUp }: { onSignUp: () => void }) {
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

  const { state, scene } = demo
  const signal = run.signal

  // Each beat's effect is bound here, keyed off what the visitor pressed — the engine's step model has
  // no action field, so the page performs and then reports.
  const act = useCallback(
    (perform: () => void, reported: DemoSignal) => () => {
      perform()
      signal(reported)
    },
    [signal],
  )

  const onRevealSplit = useMemo(
    () => act(demo.revealSplit, 'split_revealed'),
    [act, demo.revealSplit],
  )
  const onLaunch = useMemo(
    () => act(demo.launchFirstDiary, 'launched'),
    [act, demo.launchFirstDiary],
  )
  const onAddDiaries = useMemo(
    () => act(demo.addRemainingDiaries, 'diaries_added'),
    [act, demo.addRemainingDiaries],
  )
  const onRecall = useMemo(() => act(demo.recall, 'recalled'), [act, demo.recall])

  // One control, two beats: the time-travel press advances the clock while the tour is on beat 5, and
  // lifts a gist stage once the tour reaches beat 7. Free and unmetered either way — no monotonicity
  // check, no launch precondition, no consent modal, no cost.
  const stepId = run.step?.id
  const onAdvanceClock = useCallback(() => {
    if (stepId === 'gist_rise') {
      demo.riseGist()
      signal('gist_risen')
      return
    }
    demo.advanceClock()
    signal('time_advanced')
  }, [demo, signal, stepId])

  // Beat 8 is a consequence rather than an action: once the universe holds enough re-read emotion,
  // the sky takes its colour. The page applies it and then reports, so the caption never runs ahead.
  useEffect(() => {
    if (stepId !== 'color' || state.skyFilled) return
    demo.fillSky()
    signal('sky_filled')
  }, [demo, signal, state.skyFilled, stepId])

  const onDiaryRead = useMemo(() => () => signal('diary_read'), [signal])

  const onTasteBackground = useCallback(
    (ornamentId: string) => {
      demo.taste({ background: ornamentRendererKey(ornamentId) })
      signal('ornament_tasted')
    },
    [demo, signal],
  )
  const onTasteBodyShape = useCallback(
    (ornamentId: string) => {
      demo.taste({ bodyShape: ornamentRendererKey(ornamentId) })
      signal('ornament_tasted')
    },
    [demo, signal],
  )
  const onTastePalette = useCallback(() => {
    // The one palette write that reaches no server: `applyMoodColors` stamps the module-level palette
    // the render seam already reads. The `AccountService`-calling writes are banned by name in the
    // demo's import block, so a colour cannot be saved from here even by accident.
    applyMoodColors(MOODS.map((mood) => ({ mood, color: ALTERNATIVE_MOOD_COLORS[mood] })))
    demo.taste({ palette: true })
    signal('ornament_tasted')
  }, [demo, signal])

  const firstDiary = state.resolved.diaries[0]
  const splitNames = firstDiary.memories.map((member) => member.name)

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <DemoUniverseScene scene={scene} taste={state.taste} />

      <div className="pointer-events-none absolute inset-0">
        <DemoControlRail
          diaryBody={firstDiary.body}
          splitNames={splitNames}
          splitRevealed={state.splitRevealed}
          launched={state.launchedDiaryIds.length > 0}
          clock={state.clock}
          onRevealSplit={onRevealSplit}
          onLaunch={onLaunch}
          onAddDiaries={onAddDiaries}
          onAdvanceClock={onAdvanceClock}
          onRecall={onRecall}
          onSignUp={onSignUp}
        />
        <div className="pointer-events-auto absolute bottom-4 right-4 w-full max-w-xs">
          <DemoTasterRail
            tastes={state.set.scenario.ornamentTastes}
            paletteTasted={state.taste.palette}
            onTasteBackground={onTasteBackground}
            onTasteBodyShape={onTasteBodyShape}
            onTastePalette={onTastePalette}
          />
        </div>
      </div>

      {/* Beat 1's own affordance: reading the diary is what advances it, so it needs a way to say so. */}
      {run.step?.id === 'diary_appears' && (
        <button
          type="button"
          className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface/80 px-4 py-2 text-sm text-text backdrop-blur"
          onClick={onDiaryRead}
        >
          {m.demo_diary_read_action()}
        </button>
      )}

      {/* The honesty line, always on screen rather than buried in a beat: this page is a public
          surface, and the one claim it must never let a visitor form is that they are looking at a
          brain. */}
      <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 px-4 text-center text-xs text-text-subtle">
        {m.demo_theory_note()}
      </p>

      <SequenceGuide
        active={run.active}
        caption={run.step?.caption ?? null}
        anchorRect={run.anchorRect}
        progress={run.progress}
        onSkip={run.skip}
        onRemeasure={run.remeasure}
      />
    </main>
  )
}
