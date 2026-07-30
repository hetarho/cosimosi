import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActorRef, useSelector } from '@xstate/react'

import {
  measureAnchor,
  useSequenceAnchorRegistry,
  type SequenceAnchorHandle,
} from './anchor-registry.ts'
import { sequenceRunMachine, type SequenceOutcome } from './sequence.machine.ts'
import type { SequenceScript, SequenceStep } from './script.ts'
import {
  currentStep,
  isActive,
  progress,
  type SequenceProgress,
  type SequenceRect,
} from './select.ts'

// The optional React seam — the only file in the package that knows React exists, following the
// `@cosimosi/state-machine` + `@cosimosi/twinkle` precedent. The package root stays React-free so the
// machine and the selectors run in plain tests on both platforms.

export interface SequenceRunOptions {
  /**
   * How long a `dwell` step holds before advancing itself. Supplied by the host rather than read
   * here: the engine's dependency list is closed at `xstate` + `zustand` — that closure is what
   * proves it can reach no transport and no fixture — so the generated `sequence.caption_dwell_ms`
   * constant is imported by the app chrome, where every other tuning number is read.
   */
  readonly captionDwellMs: number
}

export interface SequenceRunView<Anchor extends string, Signal extends string> {
  readonly step: SequenceStep<Anchor, Signal> | null
  readonly progress: SequenceProgress
  readonly active: boolean
  readonly outcome: SequenceOutcome | null
  readonly anchorRect: SequenceRect | null
  /** Begins (or replays) a run with a fresh run id. Valid from any state, including a terminal one. */
  start: (runId: string) => void
  /** Advance if `signal` is what the current step waits for; a mismatch is simply not progress. */
  signal: (signal: Signal) => void
  skip: () => void
  /**
   * Ends the run as `abandoned` — the outcome a host reports when it tears the run down for its own
   * reasons rather than the user pressing skip. It is the host's call because only the host knows
   * that it is going away, and by the time this hook unmounts its actor is already stopped.
   */
  abandon: () => void
  /**
   * Re-measures the current step's anchor. The engine cannot subscribe to a resize or an orientation
   * change itself — that is a DOM listener on web and a `Dimensions` subscription on native — so the
   * app chrome, which already re-renders on both, calls this. It exists so the ring never chases
   * layout per frame: step change, registry change and this call are the only three reasons to
   * measure.
   */
  remeasure: () => void
}

export function useSequenceRun<Anchor extends string, Signal extends string>(
  script: SequenceScript<Anchor, Signal>,
  options: SequenceRunOptions,
): SequenceRunView<Anchor, Signal> {
  const actor = useActorRef(sequenceRunMachine)
  const snapshot = useSelector(actor, (state) => state.context)
  const step = currentStep(script, snapshot)
  const active = isActive(snapshot)

  const start = useCallback(
    (runId: string) => actor.send({ type: 'START', runId, stepCount: script.steps.length }),
    [actor, script.steps.length],
  )

  const advance = useCallback(
    (fromStepIndex: number) => actor.send({ type: 'ADVANCE', fromStepIndex }),
    [actor],
  )

  const signal = useCallback(
    (incoming: Signal) => {
      if (!active || !step) return
      if (step.advance.on !== 'signal' || step.advance.signal !== incoming) return
      advance(snapshot.stepIndex)
    },
    [active, advance, snapshot.stepIndex, step],
  )

  const skip = useCallback(() => actor.send({ type: 'SKIP' }), [actor])
  const abandon = useCallback(() => actor.send({ type: 'ABANDON' }), [actor])

  const [measureToken, setMeasureToken] = useState(0)
  const remeasure = useCallback(() => setMeasureToken((token) => token + 1), [])

  useDwellAdvance(
    active && step?.advance.on === 'dwell',
    snapshot.stepIndex,
    options.captionDwellMs,
    advance,
  )
  const anchorRect = useAnchorRect(active ? step?.anchor : undefined, measureToken)

  return useMemo(
    () => ({
      step,
      progress: progress(snapshot),
      active,
      outcome: snapshot.outcome,
      anchorRect,
      start,
      signal,
      skip,
      abandon,
      remeasure,
    }),
    [abandon, active, anchorRect, remeasure, signal, skip, snapshot, start, step],
  )
}

// Dwell timing lives here rather than in the machine, so the machine never reads a clock. The timer
// is keyed on the step index and cleared on every change and on unmount, so no suite can leave one
// pending — and a timer that does fire late carries a stale index the machine's echo guard drops.
function useDwellAdvance(
  enabled: boolean,
  stepIndex: number,
  captionDwellMs: number,
  advance: (fromStepIndex: number) => void,
): void {
  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(() => advance(stepIndex), captionDwellMs)
    return () => clearTimeout(timer)
  }, [advance, captionDwellMs, enabled, stepIndex])
}

function useAnchorRect(anchorId: string | undefined, measureToken: number): SequenceRect | null {
  const [rect, setRect] = useState<SequenceRect | null>(null)
  const anchors = useSequenceAnchorRegistry((state) => state.anchors)

  useEffect(() => {
    if (!anchorId) {
      setRect(null)
      return
    }
    let live = true
    void measureAnchor(anchorId).then((measured) => {
      if (live) setRect(measured)
    })
    return () => {
      live = false
    }
    // `anchors` is a dependency so a control that mounts AFTER its step began still gets highlighted
    // — a registry change is the only signal the engine gets that the tree moved.
  }, [anchorId, anchors, measureToken])

  return rect
}

/**
 * Registers one control's measure handle for as long as it is mounted. Hosts call this from a
 * composition site through the app's `SequenceAnchor` wrapper — never from inside a product feature
 * slice, which is what keeps every shipped slice unaware that a sequence exists.
 */
export function useSequenceAnchorRegistration(
  anchorId: string,
  measure: () => Promise<SequenceRect | null>,
): void {
  const measureRef = useRef(measure)
  measureRef.current = measure

  useEffect(() => {
    // The handle reads through the ref, so a re-rendered parent passing a new closure does not
    // churn the registry — and a registry change is what re-measures every mounted anchor.
    const handle: SequenceAnchorHandle = { measure: () => measureRef.current() }
    useSequenceAnchorRegistry.getState().register(anchorId, handle)
    return () => useSequenceAnchorRegistry.getState().unregister(anchorId)
  }, [anchorId])
}
