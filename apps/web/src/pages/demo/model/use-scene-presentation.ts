import { useCallback, useEffect, useRef, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import type { AdvanceInterval } from '@cosimosi/universe'

import type { DemoSignal } from './anchors.ts'

// A sweep that owes the tour nothing, shared so the empty case allocates once.
const NO_REPORTS: readonly DemoSignal[] = []

/**
 * The scene's own turn to speak, and the time sweep that is one way it speaks.
 *
 * A launch, a recall and a time sweep all play out on the canvas the tutorial covers, so while one
 * runs the covering lifts, the next beat's line and ring hold back, and a surface the beat would
 * stage waits its turn — three things off ONE flag, because they are one decision: nothing may be
 * put in front of the scene while the scene is the answer to what was just pressed. Pressability
 * never rides it.
 *
 * The time-passing presentation: a jump commits the clock immediately (the data path never waits on
 * presentation), then the sweep walks the DISPLAYED date previous → current so the memories dim in
 * front of the viewer — the product's own sequencing, rendered demo-locally.
 */
export function useScenePresentation(signal: (report: DemoSignal) => void) {
  const [sceneRevealing, setSceneRevealing] = useState(false)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openReveal = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = null
    setSceneRevealing(true)
  }, [])
  // The hold is what is left to WATCH once whatever played has finished, which is why the two callers
  // pass different ones: a sweep has already had the screen for its own duration and needs only the
  // settled sky read, while a birth or a return had nothing else and the hold is the whole reveal.
  const closeReveal = useCallback((holdMs: number) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setSceneRevealing(false), holdMs)
  }, [])
  const finishReveal = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = null
    setSceneRevealing(false)
  }, [])
  useEffect(
    () => () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    },
    [],
  )

  const [sweep, setSweep] = useState<AdvanceInterval | null>(null)
  const [sweepTime, setSweepTime] = useState<string | null>(null)
  // What the sweep in flight owes the tour when it LANDS. A beat whose work is a stretch of time is
  // done when that time has actually passed on screen, not when the button went down: reported at
  // press time it hands the next beat's line to the covered stretch, where a caption-only beat
  // spends its whole dwell unread. A ref because the sweep's own presentation is the only thing
  // waiting on it — nothing renders from it, so a state write would buy a re-render per jump.
  const sweepReportsRef = useRef<readonly DemoSignal[]>(NO_REPORTS)
  const playSweep = useCallback(
    (previous: string, current: string, reports: readonly DemoSignal[] = NO_REPORTS) => {
      // Nothing to walk means nothing to wait for; whatever the press owed is owed now.
      if (current <= previous) {
        for (const report of reports) signal(report)
        return
      }
      sweepReportsRef.current = reports
      openReveal()
      // The displayed clock starts at `previous` in the SAME commit the sweep begins, or the first
      // frame would flash the committed final date before the rAF loop walks back and forward.
      setSweepTime(previous)
      setSweep({ previous, current })
    },
    [openReveal, signal],
  )
  const onSweepDone = useCallback(() => {
    setSweep(null)
    setSweepTime(null)
    closeReveal(VALUES.demo.sweepSettleMs)
    const reports = sweepReportsRef.current
    sweepReportsRef.current = NO_REPORTS
    for (const report of reports) signal(report)
  }, [closeReveal, signal])

  return {
    sceneRevealing,
    openReveal,
    closeReveal,
    finishReveal,
    sweep,
    sweepTime,
    setSweepTime,
    playSweep,
    onSweepDone,
  }
}
