import type { SequenceRunSnapshot } from './sequence.machine.ts'
import type { SequenceScript, SequenceStep } from './script.ts'

// Pure selectors joining a run snapshot to the script the host holds. The script deliberately never
// enters machine context, so this is where the two meet.

export function currentStep<Anchor extends string, Signal extends string>(
  script: SequenceScript<Anchor, Signal>,
  snapshot: SequenceRunSnapshot,
): SequenceStep<Anchor, Signal> | null {
  return script.steps[snapshot.stepIndex] ?? null
}

export interface SequenceProgress {
  readonly current: number
  readonly total: number
}

/** One-based for display: step 1 of 10, not step 0. */
export function progress(snapshot: SequenceRunSnapshot): SequenceProgress {
  if (snapshot.stepCount <= 0) return { current: 0, total: 0 }
  return {
    current: Math.min(snapshot.stepIndex + 1, snapshot.stepCount),
    total: snapshot.stepCount,
  }
}

export function isActive(snapshot: SequenceRunSnapshot): boolean {
  return snapshot.runId !== null && snapshot.outcome === null
}

export interface SequenceRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SequenceViewport {
  readonly width: number
  readonly height: number
}
