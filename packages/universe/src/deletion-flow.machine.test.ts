import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { deletionFlowMachine, remainingRestoreDays } from './deletion-flow.machine.ts'

function actor() {
  return createActor(deletionFlowMachine).start()
}

describe('deletionFlowMachine', () => {
  it('full-delete branch: idle → confirmingDelete → deleting → done → idle', () => {
    const flow = actor()
    expect(flow.getSnapshot().value).toBe('idle')
    flow.send({ type: 'OPEN_DELETE', diaryId: 'd1' })
    expect(flow.getSnapshot().value).toBe('confirmingDelete')
    expect(flow.getSnapshot().context.diaryId).toBe('d1')
    flow.send({ type: 'CONFIRM' })
    expect(flow.getSnapshot().value).toBe('deleting')
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('done')
    flow.send({ type: 'RESET' })
    expect(flow.getSnapshot().value).toBe('idle')
    expect(flow.getSnapshot().context.diaryId).toBeNull()
  })

  it('letting-go branch: idle → phrasing → suggesting → approving → sealing → done', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    expect(flow.getSnapshot().value).toBe('phrasing')
    expect(flow.getSnapshot().context.episodicMemoryId).toBe('m1')
    flow.send({ type: 'SUGGEST' })
    expect(flow.getSnapshot().value).toBe('suggesting')
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('approving')
    flow.send({ type: 'SEAL' })
    expect(flow.getSnapshot().value).toBe('sealing')
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('done')
  })

  it('a failed Release returns to a retriable confirmingDelete (nothing removed)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_DELETE', diaryId: 'd1' })
    flow.send({ type: 'CONFIRM' })
    flow.send({ type: 'ERROR' })
    expect(flow.getSnapshot().value).toBe('confirmingDelete')
    flow.send({ type: 'CONFIRM' })
    expect(flow.getSnapshot().value).toBe('deleting')
  })

  it('a failed SuggestLetGo returns to a retriable phrasing', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    flow.send({ type: 'SUGGEST' })
    flow.send({ type: 'ERROR' })
    expect(flow.getSnapshot().value).toBe('phrasing')
  })

  it('a failed LetGo returns to approving with nothing sealed (retriable)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    flow.send({ type: 'SUGGEST' })
    flow.send({ type: 'DONE' })
    flow.send({ type: 'SEAL' })
    flow.send({ type: 'ERROR' })
    expect(flow.getSnapshot().value).toBe('approving')
    flow.send({ type: 'SEAL' })
    expect(flow.getSnapshot().value).toBe('sealing')
  })

  it('BACK from approving reopens phrasing to reword', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    flow.send({ type: 'SUGGEST' })
    flow.send({ type: 'DONE' })
    flow.send({ type: 'BACK' })
    expect(flow.getSnapshot().value).toBe('phrasing')
  })

  it('CANCEL closes to idle from an interactive step and drops the target', () => {
    for (const openTo of [
      { type: 'OPEN_DELETE', diaryId: 'd1' } as const,
      { type: 'OPEN_LETGO', episodicMemoryId: 'm1' } as const,
    ]) {
      const flow = actor()
      flow.send(openTo)
      flow.send({ type: 'CANCEL' })
      expect(flow.getSnapshot().value).toBe('idle')
      expect(flow.getSnapshot().context.diaryId).toBeNull()
      expect(flow.getSnapshot().context.episodicMemoryId).toBeNull()
    }
  })

  it('CANCEL also closes from approving (before a seal is committed)', () => {
    const flow = actor()
    flow.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    flow.send({ type: 'SUGGEST' })
    flow.send({ type: 'DONE' })
    expect(flow.getSnapshot().value).toBe('approving')
    flow.send({ type: 'CANCEL' })
    expect(flow.getSnapshot().value).toBe('idle')
  })

  it('the loading states are un-closable — CANCEL is ignored in flight (no stale-completion race)', () => {
    // deleting
    const del = actor()
    del.send({ type: 'OPEN_DELETE', diaryId: 'd1' })
    del.send({ type: 'CONFIRM' })
    del.send({ type: 'CANCEL' })
    expect(del.getSnapshot().value).toBe('deleting')

    // suggesting
    const sug = actor()
    sug.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    sug.send({ type: 'SUGGEST' })
    sug.send({ type: 'CANCEL' })
    expect(sug.getSnapshot().value).toBe('suggesting')

    // sealing
    const seal = actor()
    seal.send({ type: 'OPEN_LETGO', episodicMemoryId: 'm1' })
    seal.send({ type: 'SUGGEST' })
    seal.send({ type: 'DONE' })
    seal.send({ type: 'SEAL' })
    seal.send({ type: 'CANCEL' })
    expect(seal.getSnapshot().value).toBe('sealing')
  })
})

describe('remainingRestoreDays', () => {
  const RETENTION = 30
  it('reads the window from the config value + deleted_at, not a hardcoded 30', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    const deletedAt = '2026-07-05T00:00:00Z'
    expect(remainingRestoreDays(deletedAt, RETENTION, now)).toBe(20)
    expect(remainingRestoreDays(deletedAt, 14, now)).toBe(4)
  })

  it('clamps a closed window to 0 (the backend sweep hard-deletes past it)', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    expect(remainingRestoreDays('2026-07-05T00:00:00Z', RETENTION, now)).toBe(0)
  })

  it('is 0 on an unparseable deleted_at rather than throwing', () => {
    expect(remainingRestoreDays('', RETENTION, new Date())).toBe(0)
  })
})
