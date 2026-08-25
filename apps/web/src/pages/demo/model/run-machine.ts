import { setup } from 'xstate'
import type { StateValue } from 'xstate'

import { DEMO_BEAT_IDS, type DemoBeatId } from '@cosimosi/demo'

import type { DemoAnchor } from './anchors.ts'

// The run's phase machine: ONE explicit FSM owns whether the page is a tutorial or a playroom,
// and every control's availability is derived from its state — never from a scattered boolean. It
// stands BESIDE the shared sequence engine, not inside it: the engine owns the tour's presentation
// (caption, highlight, dwell, skip chrome), this machine owns what those same advances mean for
// the chrome's interactivity. `syncDemoRunMachine` below is the one place the two meet, so they
// cannot walk apart.
//
// `freePlay` is permanent by shape: no transition leaves it, which is what makes "the tutorial is
// over" unrepresentable to undo ([O4]'s skip lands here too, from any step).

export type DemoRunEvent = { type: 'NEXT' } | { type: 'SKIP' }

const beatStates = Object.fromEntries(
  DEMO_BEAT_IDS.map((beat, index) => [
    beat,
    {
      on: {
        NEXT:
          index + 1 < DEMO_BEAT_IDS.length
            ? { target: DEMO_BEAT_IDS[index + 1] }
            : { target: '#demoRun.freePlay' },
      },
    },
  ]),
)

export const demoRunMachine = setup({
  types: {
    events: {} as DemoRunEvent,
  },
}).createMachine({
  id: 'demoRun',
  initial: 'tutorial',
  states: {
    tutorial: {
      initial: DEMO_BEAT_IDS[0],
      states: beatStates,
      // Skip is available from EVERY step, as a transition table rather than a UI habit ([O4]).
      on: { SKIP: { target: 'freePlay' } },
    },
    freePlay: {},
  },
})

export type DemoRunPhase = { kind: 'tutorial'; beatId: DemoBeatId } | { kind: 'freePlay' }

export function demoRunPhase(value: StateValue): DemoRunPhase {
  if (typeof value === 'object' && value !== null && 'tutorial' in value) {
    return { kind: 'tutorial', beatId: value.tutorial as DemoBeatId }
  }
  return { kind: 'freePlay' }
}

// Which controls a tutorial step leaves interactive — the ONE derivation the chrome may gate from,
// and the same list the mask cuts its hole from. Exhaustive over the beats, so a beat added to the
// scenario without a gating row is a compile error. Four beats deliberately widen past their own
// anchor. The opening beat lights the diary card as well as the control that reads it, because a
// beat asking someone to read a diary has to leave the diary uncovered. The neuron-reuse beat opens
// the whole write flow rather than one button: drawing is only its first press, and the split and
// launch that finish the drawn diary are the beat's own work. The decorating beat opens the catalog rows
// beside its own button for the same reason — the beat is the round trip through the sheet, and a
// visitor who may press only the one row the ring happens to sit on is being shown a slideshow.
// The closing CTA beat opens EVERYTHING —
// `null` below means "the whole room": its caption is a valediction over a playroom that is
// already free, so a visitor who presses anything but the highlighted CTA simply starts playing
// instead of being funneled out. The skip affordance is not listed because it is not a
// `DemoAnchor` — it lives in the sequence chrome, above this gate, and stays interactive
// throughout ([O4]).
const TUTORIAL_INTERACTIVE: Readonly<Record<DemoBeatId, readonly DemoAnchor[] | null>> = {
  diary_appears: ['diary-card', 'diary-read-action'],
  split: ['split-action'],
  launch: ['launch-action'],
  neuron_reuse: ['write-action', 'split-action', 'launch-action'],
  time_accelerates: ['time-month-action'],
  recall: ['recall-action'],
  gist_rise: ['time-month-action'],
  color: [],
  ornament_taster: ['decorate-action', 'ornament-row-action'],
  signup_cta: null,
}

/**
 * The controls a tutorial beat opens, for the page's mask to measure its hole from — `null` means
 * the whole room (the closing beat), an empty list means none (the sky beat plays on its own).
 */
export function tutorialInteractiveAnchors(beatId: DemoBeatId): readonly DemoAnchor[] | null {
  return TUTORIAL_INTERACTIVE[beatId]
}

/**
 * Whether a control is pressable in the given phase. Free play opens everything; a tutorial step
 * opens only its own controls (the closing beat opens the whole room). `instanceIsTutorialTarget`
 * narrows a per-memory control (recall, entry-open) to the one memory the beat actually points at
 * — the scenario's recall target — so "only the current beat's anchored control" holds even when
 * the control kind repeats per memory.
 */
export function isDemoAnchorInteractive(
  phase: DemoRunPhase,
  anchor: DemoAnchor,
  instanceIsTutorialTarget = true,
): boolean {
  if (phase.kind === 'freePlay') return true
  const interactive = TUTORIAL_INTERACTIVE[phase.beatId]
  if (interactive === null) return true
  return interactive.includes(anchor) && instanceIsTutorialTarget
}

/**
 * Drives the phase machine from what the sequence engine reports — the single meeting point of the
 * two machines. The engine's step index and outcome are its own snapshot facts; this walks the
 * phase machine until it agrees: N engine advances → N NEXTs, a skip (or the host's abandon) →
 * SKIP, completion → the final NEXT out of the last beat. Idempotent, so it can run on every
 * render without double-stepping (each NEXT moves exactly one beat and the loop re-reads).
 */
export function syncDemoRunMachine(
  actor: {
    getSnapshot: () => { value: StateValue }
    send: (event: DemoRunEvent) => void
  },
  engine: { stepIndex: number; outcome: 'completed' | 'skipped' | 'abandoned' | null },
): void {
  for (let guard = 0; guard <= DEMO_BEAT_IDS.length; guard += 1) {
    const phase = demoRunPhase(actor.getSnapshot().value)
    if (phase.kind === 'freePlay') return
    if (engine.outcome === 'skipped' || engine.outcome === 'abandoned') {
      actor.send({ type: 'SKIP' })
      return
    }
    const beatIndex = DEMO_BEAT_IDS.indexOf(phase.beatId)
    const target = engine.outcome === 'completed' ? DEMO_BEAT_IDS.length : engine.stepIndex
    if (beatIndex >= target) return
    actor.send({ type: 'NEXT' })
  }
}
