import { describe, expect, it } from 'vitest'

import { diaryRecallAdvanceAnnouncement } from './recall-diary-stars.ts'

const response = (previous: string, current: string) => ({
  $typeName: 'cosimosi.memory.v1.RecallDiaryStarsResponse' as const,
  diaryId: 'd1',
  episodicMemoryIds: ['m1', 'm2'],
  previousUniverseTime: previous,
  universeTime: current,
})

describe('diaryRecallAdvanceAnnouncement', () => {
  it('plays the returned before→after interval and reveals no new stars', () => {
    const advance = diaryRecallAdvanceAnnouncement(response('2026-06-01', '2026-07-01'))
    expect(advance).toEqual({
      interval: { previous: '2026-06-01', current: '2026-07-01' },
      revealNeuronIds: [],
    })
  })

  it('is null for an unborn clock (empty previous) — nothing to accelerate', () => {
    expect(diaryRecallAdvanceAnnouncement(response('', '2026-07-01'))).toBeNull()
  })

  it('is null for a same-day sync (no interval)', () => {
    expect(diaryRecallAdvanceAnnouncement(response('2026-07-01', '2026-07-01'))).toBeNull()
  })
})
