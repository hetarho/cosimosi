import { describe, expect, it } from 'vitest'

import type { DecorationTourStage } from './decoration-tour.ts'
import type { DemoSurface } from './demo-surface.machine.ts'
import type { DemoPhaseKey } from './recall-panel.ts'
import { demoRingTarget, type DemoRingTarget } from './ring-target.ts'

const NONE: DemoSurface = { kind: 'none' }
const WRITING: DemoSurface = { kind: 'writing' }
const MEMORY_PANEL: DemoSurface = { kind: 'memory', memoryId: 'm1' }
const RECALLING: DemoSurface = { kind: 'recall', memoryId: 'm1', applied: false }
const RECALLED: DemoSurface = { kind: 'recall', memoryId: 'm1', applied: true }
const DECORATING: DemoSurface = { kind: 'decorating' }

const anchor = (name: string): DemoRingTarget =>
  ({ kind: 'anchor', anchor: name }) as DemoRingTarget

describe('demoRingTarget', () => {
  const rows: readonly [
    DemoPhaseKey,
    DemoSurface,
    boolean | null,
    DecorationTourStage,
    DemoRingTarget,
  ][] = [
    // neuron reuse: draw, then split, then launch — inside the sheet
    ['neuron_reuse', WRITING, false, 'sky', anchor('split-action')],
    ['neuron_reuse', WRITING, true, 'sky', anchor('launch-action')],
    ['neuron_reuse', WRITING, null, 'sky', null],
    ['neuron_reuse', NONE, false, 'sky', null],
    // recall: confirm, then come back out
    ['recall', RECALLING, null, 'sky', anchor('recall-confirm-action')],
    ['recall', RECALLED, null, 'sky', anchor('recall-dismiss-action')],
    ['recall', MEMORY_PANEL, null, 'sky', null],
    // decorating: sky, unobstructed preview, shape, then the return action
    ['ornament_taster', DECORATING, null, 'sky', anchor('ornament-row-action')],
    ['ornament_taster', DECORATING, null, 'sky-preview', { kind: 'none' }],
    ['ornament_taster', DECORATING, null, 'shape', anchor('ornament-shape-action')],
    ['ornament_taster', DECORATING, null, 'finish', anchor('decorate-close-action')],
    ['ornament_taster', NONE, null, 'finish', null],
    // every other beat and free play keep the engine's own anchor
    ['split', WRITING, false, 'sky', null],
    ['freePlay', RECALLING, null, 'finish', null],
    ['freePlay', DECORATING, null, 'finish', null],
  ]

  it.each(rows)(
    '%s over %o (split %s, decoration %s)',
    (beat, surface, splitRevealed, decorationStage, want) => {
      expect(demoRingTarget({ beat, surface, splitRevealed, decorationStage })).toEqual(want)
    },
  )
})
