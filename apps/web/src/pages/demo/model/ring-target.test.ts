import { describe, expect, it } from 'vitest'

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
  const rows: readonly [DemoPhaseKey, DemoSurface, boolean | null, boolean, DemoRingTarget][] = [
    // neuron reuse: draw, then split, then launch — inside the sheet
    ['neuron_reuse', WRITING, false, false, anchor('split-action')],
    ['neuron_reuse', WRITING, true, false, anchor('launch-action')],
    ['neuron_reuse', WRITING, null, false, null],
    ['neuron_reuse', NONE, false, false, null],
    // recall: confirm, then come back out
    ['recall', RECALLING, null, false, anchor('recall-confirm-action')],
    ['recall', RECALLED, null, false, anchor('recall-dismiss-action')],
    ['recall', MEMORY_PANEL, null, false, null],
    // decorating: onto a row, then the ring stands down for the trip back out
    ['ornament_taster', DECORATING, null, false, anchor('ornament-row-action')],
    ['ornament_taster', DECORATING, null, true, { kind: 'none' }],
    ['ornament_taster', NONE, null, true, null],
    // every other beat and free play keep the engine's own anchor
    ['split', WRITING, false, false, null],
    ['freePlay', RECALLING, null, true, null],
    ['freePlay', DECORATING, null, true, null],
  ]

  it.each(rows)(
    '%s over %o (split %s, tasted %s)',
    (beat, surface, splitRevealed, tasted, want) => {
      expect(demoRingTarget({ beat, surface, splitRevealed, tasted })).toEqual(want)
    },
  )
})
