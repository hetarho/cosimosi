import { setup } from 'xstate'

import type { DemoTasteOrnament } from './use-demo-run.ts'
import type { DemoAnchor } from './anchors.ts'

export type DecorationTourStage = 'sky' | 'sky-preview' | 'shape' | 'finish'

type DecorationTourEvent =
  | { type: 'CHANGE'; surface: DemoTasteOrnament; before: string | null; after: string | null }
  | { type: 'PREVIEW_DONE' }

/** Progress persists across sheet visits; the surface machine remains the sole modal owner. */
export const decorationTourMachine = setup({
  types: { events: {} as DecorationTourEvent },
  guards: {
    changedSky: ({ event }) =>
      event.type === 'CHANGE' &&
      advanceDecorationTour('sky', event.surface, event.before, event.after) === 'sky-preview',
    changedShape: ({ event }) =>
      event.type === 'CHANGE' &&
      advanceDecorationTour('shape', event.surface, event.before, event.after) === 'finish',
  },
}).createMachine({
  id: 'decorationTour',
  initial: 'sky',
  states: {
    sky: { on: { CHANGE: { guard: 'changedSky', target: 'sky-preview' } } },
    'sky-preview': { on: { PREVIEW_DONE: 'shape' } },
    shape: { on: { CHANGE: { guard: 'changedShape', target: 'finish' } } },
    finish: {},
  },
})

export function decorationTourAnchor(stage: DecorationTourStage): DemoAnchor {
  return stage === 'sky' || stage === 'sky-preview'
    ? 'ornament-row-action'
    : stage === 'shape'
      ? 'ornament-shape-action'
      : 'decorate-close-action'
}

/** A no-op or a different catalogue group cannot complete the requested visual change. */
export function advanceDecorationTour(
  stage: DecorationTourStage,
  surface: DemoTasteOrnament,
  before: string | null,
  after: string | null,
): DecorationTourStage {
  if (before === after) return stage
  if (stage === 'sky' && surface === 'background') return 'sky-preview'
  if (stage === 'shape' && surface === 'bodyShape') return 'finish'
  return stage
}

export function differentDecorationExample(
  keys: readonly string[],
  current: string,
  preferred: string,
): string | undefined {
  return keys.includes(preferred) && preferred !== current
    ? preferred
    : keys.find((key) => key !== current)
}
