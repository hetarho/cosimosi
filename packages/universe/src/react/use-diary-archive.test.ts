import { beforeEach, describe, expect, it } from 'vitest'
import type { Diary } from '@cosimosi/memory'

import { useDiaryStore } from '../diary-store.ts'
import { syncDiaryArchiveMirror } from './use-diary-archive.ts'

const diary = (id: string, memberIds: readonly string[] = []): Diary => ({
  id,
  body: `body ${id}`,
  diaryDate: '2026-07-01',
  createdUniverseTime: '2026-07-01',
  memories: memberIds.map((episodicMemoryId) => ({
    episodicMemoryId,
    name: episodicMemoryId,
    mood: 'JOY',
  })),
})

describe('useDiaryArchive mirror synchronization', () => {
  beforeEach(() => useDiaryStore.getState().clear())

  it('leaves the shared mirror untouched while the read is disabled', () => {
    useDiaryStore.getState().setAll([diary('existing')])

    syncDiaryArchiveMirror(false, true, [])

    expect(useDiaryStore.getState().ids).toEqual(['existing'])
  })

  it('keeps a non-owning day read when the owning archive settles afterwards', () => {
    syncDiaryArchiveMirror(true, true, [diary('owner-old')])
    syncDiaryArchiveMirror(true, false, [diary('picked-day', ['memory'])])

    syncDiaryArchiveMirror(true, true, [diary('owner-new')])

    const state = useDiaryStore.getState()
    expect(state.ids).toEqual(['owner-new', 'picked-day'])
    expect(state.byId['picked-day'].memories[0]?.episodicMemoryId).toBe('memory')
  })

  it('removes a non-owning day after its enabled read settles empty', () => {
    syncDiaryArchiveMirror(true, true, [diary('owner')])
    syncDiaryArchiveMirror(true, false, [diary('picked-day')])

    syncDiaryArchiveMirror(true, false, [])

    expect(useDiaryStore.getState().ids).toEqual(['owner'])
    expect(useDiaryStore.getState().byId['picked-day']).toBeUndefined()
  })
})
