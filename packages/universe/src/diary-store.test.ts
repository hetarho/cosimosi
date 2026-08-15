import { beforeEach, describe, expect, it } from 'vitest'
import type { Diary } from '@cosimosi/memory'

import { useDiaryStore } from './diary-store.ts'

const diary = (id: string, memberIds: readonly string[]): Diary => ({
  id,
  body: `body ${id}`,
  diaryDate: '2026-07-01',
  createdUniverseTime: '2026-07-01',
  memories: memberIds.map((mid) => ({ episodicMemoryId: mid, name: mid, mood: 'JOY' })),
})

describe('useDiaryStore', () => {
  beforeEach(() => useDiaryStore.getState().clear())

  it('keys diaries by id and preserves the arrival (reverse-chron) order', () => {
    useDiaryStore.getState().setAll([diary('d2', ['m1']), diary('d1', [])])
    const state = useDiaryStore.getState()
    expect(state.ids).toEqual(['d2', 'd1'])
    expect(state.byId['d2'].memories.map((m) => m.episodicMemoryId)).toEqual(['m1'])
  })

  it('lists an all-let-go diary with zero split members', () => {
    useDiaryStore.getState().setAll([diary('d1', [])])
    expect(useDiaryStore.getState().byId['d1'].memories).toHaveLength(0)
  })

  // A narrower read beside the paged one — the calendar's day read — contributes what it found
  // without taking the page away. Anything looked up by id has to find both.
  it('adds a narrower read’s entries without dropping the page it already holds', () => {
    useDiaryStore.getState().setAll([diary('d2', ['m1']), diary('d1', [])])
    useDiaryStore.getState().add([diary('d9', ['m9'])])
    const state = useDiaryStore.getState()
    expect(state.ids).toEqual(['d2', 'd1', 'd9'])
    expect(state.byId['d9'].memories.map((member) => member.episodicMemoryId)).toEqual(['m9'])
    expect(state.byId['d2']).toBeDefined()
  })

  it('refreshes an entry it already holds rather than listing it twice', () => {
    useDiaryStore.getState().setAll([diary('d1', [])])
    useDiaryStore.getState().add([diary('d1', ['m1'])])
    const state = useDiaryStore.getState()
    expect(state.ids).toEqual(['d1'])
    expect(state.byId['d1'].memories).toHaveLength(1)
  })

  it('retains a narrower read when the owning page settles later', () => {
    useDiaryStore.getState().setAll([diary('d2', [])])
    useDiaryStore.getState().add([diary('d9', ['m9'])])

    useDiaryStore.getState().setAll([diary('d3', []), diary('d2', ['m2'])])

    const state = useDiaryStore.getState()
    expect(state.ids).toEqual(['d3', 'd2', 'd9'])
    expect(state.byId['d9'].memories[0]?.episodicMemoryId).toBe('m9')
    expect(state.byId['d2'].memories[0]?.episodicMemoryId).toBe('m2')
  })

  it('does nothing for an empty narrower read', () => {
    useDiaryStore.getState().setAll([diary('d1', [])])
    const before = useDiaryStore.getState()
    useDiaryStore.getState().add([])
    expect(useDiaryStore.getState()).toBe(before)
  })

  it('replaces a narrower read and removes its stale entries when it settles empty', () => {
    useDiaryStore.getState().setAll([diary('owner', [])])
    useDiaryStore.getState().replaceContributions([diary('picked-day', ['memory'])])

    useDiaryStore.getState().replaceContributions([])

    expect(useDiaryStore.getState()).toMatchObject({
      ids: ['owner'],
      contributedIds: [],
    })
    expect(useDiaryStore.getState().byId['picked-day']).toBeUndefined()
  })

  it('replaces one narrower day with another without retaining the old day', () => {
    useDiaryStore.getState().replaceContributions([diary('day-a', [])])

    useDiaryStore.getState().replaceContributions([diary('day-b', [])])

    expect(useDiaryStore.getState().ids).toEqual(['day-b'])
    expect(useDiaryStore.getState().byId['day-a']).toBeUndefined()
  })
})
