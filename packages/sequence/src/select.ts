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

export type CaptionPlacement = 'bottom' | 'top' | 'center'

/**
 * Where the caption band goes. Not cosmetic: the shipped universe page puts the writing sheet
 * bottom-center, which is exactly where the first onboarding beat points — so a caption fixed to the
 * bottom would sit on top of the control it is describing. It relocates only to get out of the way,
 * never for variety.
 */
export function resolveCaptionPlacement(
  anchorRect: SequenceRect | null,
  viewport: SequenceViewport,
  bandHeight: number,
): CaptionPlacement {
  if (!anchorRect) return 'bottom'
  const bandTop = viewport.height - Math.max(0, bandHeight)
  const anchorBottom = anchorRect.y + anchorRect.height
  return anchorBottom > bandTop && anchorRect.y < viewport.height ? 'top' : 'bottom'
}

/**
 * Where the floating `center` caption's midline sits, as a fraction of the viewport height. Just
 * ABOVE the middle: the surfaces that interrupt on a narrow screen come up from the bottom edge
 * (`Dialog` is a sheet there, and so is every panel), so the free room is the upper half — while the
 * eyeline is still the middle, not the top edge. Renderer and resolver read the same number, or the
 * band the resolver yields for would not be the band the line renders in.
 */
export const CENTERED_CAPTION_MIDLINE = 0.42

/**
 * The floating variant a host opts into when its guidance should sit in the visitor's eyeline
 * rather than along an edge. `center` renders slightly ABOVE the middle (see the constant) and
 * still yields: a step whose anchored control crosses that band falls back to the edge resolution
 * above, because guidance laid over the very control it describes guides nothing.
 */
export function resolveCenteredCaptionPlacement(
  anchorRect: SequenceRect | null,
  viewport: SequenceViewport,
  bandHeight: number,
): CaptionPlacement {
  if (!anchorRect) return 'center'
  const bandTop = viewport.height * CENTERED_CAPTION_MIDLINE - Math.max(0, bandHeight) / 2
  const bandBottom = bandTop + Math.max(0, bandHeight)
  const anchorBottom = anchorRect.y + anchorRect.height
  const crossesBand = anchorBottom > bandTop && anchorRect.y < bandBottom
  return crossesBand ? resolveCaptionPlacement(anchorRect, viewport, bandHeight) : 'center'
}
