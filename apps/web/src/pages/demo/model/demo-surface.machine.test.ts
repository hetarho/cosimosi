import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import {
  demoSurface,
  demoSurfaceMachine,
  type DemoSurface,
  type DemoSurfaceEvent,
} from './demo-surface.machine.ts'

function surfaceAfter(...events: DemoSurfaceEvent[]): DemoSurface {
  const actor = createActor(demoSurfaceMachine).start()
  for (const event of events) actor.send(event)
  const surface = demoSurface(actor.getSnapshot())
  actor.stop()
  return surface
}

const OPENERS: Record<string, DemoSurfaceEvent[]> = {
  writing: [],
  memory: [{ type: 'CLOSE_WRITING' }, { type: 'SELECT_MEMORY', memoryId: 'm1' }],
  recall: [
    { type: 'CLOSE_WRITING' },
    { type: 'SELECT_MEMORY', memoryId: 'm1' },
    { type: 'REQUEST_RECALL', memoryId: 'm1' },
  ],
  reading: [
    { type: 'CLOSE_WRITING' },
    { type: 'SELECT_MEMORY', memoryId: 'm1' },
    { type: 'OPEN_DIARY', diaryId: 'd1' },
  ],
  decorating: [{ type: 'OPEN_DECORATION' }],
}

describe('demoSurfaceMachine', () => {
  it('opens on the drafted diary', () => {
    expect(surfaceAfter()).toEqual({ kind: 'writing' })
  })

  it('walks a memory into its recall walk and back out', () => {
    const opened = OPENERS.recall ?? []
    expect(surfaceAfter(...opened)).toEqual({ kind: 'recall', memoryId: 'm1', applied: false })
    expect(surfaceAfter(...opened, { type: 'RECALL_APPLIED' })).toEqual({
      kind: 'recall',
      memoryId: 'm1',
      applied: true,
    })
    expect(surfaceAfter(...opened, { type: 'RECALL_APPLIED' }, { type: 'CLOSE_RECALL' })).toEqual({
      kind: 'none',
    })
  })

  it('hands a memory to the diary it was split from', () => {
    expect(surfaceAfter(...(OPENERS.reading ?? []))).toEqual({ kind: 'reading', diaryId: 'd1' })
  })

  // Exclusivity: from every open surface, opening another one replaces it — there is no event
  // sequence that leaves two up.
  it.each(Object.entries(OPENERS))('lets nothing stack over an open %s surface', (_, opened) => {
    expect(surfaceAfter(...opened, { type: 'OPEN_DECORATION' })).toEqual({ kind: 'decorating' })
    expect(surfaceAfter(...opened, { type: 'OPEN_WRITING' })).toEqual({ kind: 'writing' })
  })

  it('ignores a close from a surface that is not the one up', () => {
    const memory = OPENERS.memory ?? []
    for (const close of [
      'CLOSE_WRITING',
      'CLOSE_RECALL',
      'CLOSE_DIARY',
      'CLOSE_DECORATION',
    ] as const) {
      expect(surfaceAfter(...memory, { type: close })).toEqual({ kind: 'memory', memoryId: 'm1' })
    }
    expect(surfaceAfter({ type: 'CLOSE_MEMORY' })).toEqual({ kind: 'writing' })
  })

  it('stages the recall memory over a sheet left open, closing the sheet', () => {
    expect(surfaceAfter({ type: 'SELECT_MEMORY', memoryId: 'm2' })).toEqual({
      kind: 'memory',
      memoryId: 'm2',
    })
  })

  it('remembers a tried-on ornament after the decoration sheet closes', () => {
    const actor = createActor(demoSurfaceMachine).start()
    actor.send({ type: 'OPEN_DECORATION' })
    actor.send({ type: 'TASTED' })
    actor.send({ type: 'CLOSE_DECORATION' })
    actor.send({ type: 'OPEN_DECORATION' })
    expect(actor.getSnapshot().context.tasted).toBe(true)
    actor.stop()
  })
})
