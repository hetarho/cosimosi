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
  beforeEach(() => useDiaryStore.getState().setAll([]))

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
})
