import type { DemoAnchor } from './anchors.ts'
import type { DemoSurface } from './demo-surface.machine.ts'
import type { DemoPhaseKey } from './recall-panel.ts'

/**
 * Where the tutorial ring stands when a beat's work runs across a surface its first press opened:
 * an anchor of its own, `none` (the ring stands down), or `null` for the engine's own step anchor.
 *
 * Three beats walk the ring with the visitor instead of leaving it on a button already pressed. The
 * neuron-reuse beat draws a diary, then splits and launches it inside the writing sheet. The recall
 * beat's 회고하기 closes the panel that held its anchor, and the walk's own two presses finish it.
 * The decorating beat goes into the sheet, onto a row, and back out — and the way out is the sheet's
 * own close, a control the shared primitive owns and this page cannot anchor, so the ring stands
 * down and the caption carries that leg alone.
 */
export type DemoRingTarget =
  { readonly kind: 'anchor'; readonly anchor: DemoAnchor } | { readonly kind: 'none' } | null

export interface DemoRingInputs {
  readonly beat: DemoPhaseKey
  readonly surface: DemoSurface
  /** Whether the drafted diary on the writing sheet has been split yet; null with no draft. */
  readonly splitRevealed: boolean | null
  /** Whether anything has been tried on in the decoration sheet. */
  readonly tasted: boolean
}

export function demoRingTarget({
  beat,
  surface,
  splitRevealed,
  tasted,
}: DemoRingInputs): DemoRingTarget {
  if (beat === 'neuron_reuse' && surface.kind === 'writing' && splitRevealed !== null) {
    return { kind: 'anchor', anchor: splitRevealed ? 'launch-action' : 'split-action' }
  }
  if (beat === 'recall' && surface.kind === 'recall') {
    return {
      kind: 'anchor',
      anchor: surface.applied ? 'recall-dismiss-action' : 'recall-confirm-action',
    }
  }
  if (beat === 'ornament_taster' && surface.kind === 'decorating') {
    return tasted ? { kind: 'none' } : { kind: 'anchor', anchor: 'ornament-row-action' }
  }
  return null
}
