import { describe, expect, it } from 'vitest'

import { AchievementAxis, groupByAxis, type AchievementView } from './achievement.ts'
import {
  achievementBody,
  achievementTitle,
  axisLabel,
  hasAchievementCopy,
} from './achievement-copy.ts'
import { claimState, claimableCount } from './progress.ts'
import { achievedSnapshot, newlyAchieved } from './unlock-diff.ts'

function view(overrides: Partial<AchievementView> = {}): AchievementView {
  return {
    id: 'first_diary',
    axis: AchievementAxis.FIRST_EXPERIENCE,
    target: 1,
    progress: 0,
    rewardTwinkle: 50,
    rewardOrnamentId: '',
    achieved: false,
    claimed: false,
    rewardSettled: false,
    ...overrides,
  }
}

describe('claim state', () => {
  it('is exactly one of four, derived from the three server booleans', () => {
    expect(claimState(view())).toBe('locked')
    expect(claimState(view({ achieved: true }))).toBe('claimable')
    expect(claimState(view({ achieved: true, claimed: true, rewardSettled: true }))).toBe('claimed')
    // A claimed row is necessarily achieved, and a settled reward is already gone — claimed wins.
    expect(claimState(view({ achieved: false, claimed: true, rewardSettled: true }))).toBe(
      'claimed',
    )
  })

  it('separates a claim whose reward never landed from one that is finished', () => {
    // The state R001 named: the server recorded the claim, the credit did not arrive, and rendering
    // it as `claimed` is what removed the only affordance that could recover it.
    expect(claimState(view({ achieved: true, claimed: true }))).toBe('unpaid')
  })

  it('counts every row still waiting for its reward, from the booleans the rows read', () => {
    expect(
      claimableCount([
        view({ id: 'a', achieved: true }),
        view({ id: 'b', achieved: true, claimed: true, rewardSettled: true }),
        view({ id: 'c' }),
        // Claimed but unsettled: the reward has not arrived, so it is still waiting — and the row
        // under this summary renders a retry button, which "nothing waiting" would contradict.
        view({ id: 'd', achieved: true, claimed: true }),
      ]),
    ).toBe(2)
  })
})

describe('unlock diff', () => {
  const entries = [view({ id: 'a', achieved: true }), view({ id: 'b' })]

  it('notifies nothing on the first resolution of a session', () => {
    // The whole point: a returning user with unclaimed achievements must see no toast burst at
    // sign-in, and an absent snapshot is what "first resolution" means.
    expect(newlyAchieved(undefined, entries)).toEqual([])
  })

  it('reports only ids that flipped and are still unclaimed', () => {
    const before = achievedSnapshot([view({ id: 'a' }), view({ id: 'b' })])
    expect(newlyAchieved(before, entries).map((entry) => entry.id)).toEqual(['a'])
    // Already achieved last time → not new.
    expect(newlyAchieved(achievedSnapshot(entries), entries)).toEqual([])
    // Achieved AND claimed in the same window → nothing to notice; the reward is taken.
    expect(
      newlyAchieved(before, [view({ id: 'a', achieved: true, claimed: true }), view({ id: 'b' })]),
    ).toEqual([])
  })

  it('ignores an id absent from the previous snapshot', () => {
    // A row the catalog only just started publishing has no `false` to flip from, so it is not an
    // unlock — it is a new row. Announcing it would be announcing a deploy.
    const before = achievedSnapshot([view({ id: 'b' })])
    expect(newlyAchieved(before, entries)).toEqual([])
  })
})

describe('grouping', () => {
  it('keeps the server order for groups and for rows inside them', () => {
    const grouped = groupByAxis([
      view({ id: 'diary_20', axis: AchievementAxis.DIARY_TOTAL }),
      view({ id: 'first_diary' }),
      view({ id: 'diary_5', axis: AchievementAxis.DIARY_TOTAL }),
    ])
    // DIARY_TOTAL's first row arrived first, so its heading comes first. A walk over a local axis list
    // would have put FIRST_EXPERIENCE first — that is the client reordering the server's answer.
    expect(grouped.map((group) => group.axis)).toEqual([
      AchievementAxis.DIARY_TOTAL,
      AchievementAxis.FIRST_EXPERIENCE,
    ])
    expect(grouped[0]?.entries.map((entry) => entry.id)).toEqual(['diary_20', 'diary_5'])
  })

  it('renders a row on an axis this build does not know', () => {
    // The case that makes this matter: a newer server adds an axis. Grouping from a local list would
    // drop the row entirely, and an achieved row that never renders is a reward nobody can claim.
    const unknownAxis = 99 as AchievementAxis
    const grouped = groupByAxis([
      view({ id: 'from_the_future', axis: unknownAxis, achieved: true }),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.entries.map((entry) => entry.id)).toEqual(['from_the_future'])
  })
})

describe('copy', () => {
  it('resolves a title and body for a known id', () => {
    expect(hasAchievementCopy('first_diary')).toBe(true)
    expect(achievementTitle('first_diary')).not.toBe('')
    expect(achievementBody('first_diary')).not.toBe('')
  })

  it('falls back for an unknown id without losing its claimability', () => {
    // Copy completeness is a content gate; claimability is a correctness one. A row whose words have
    // not shipped still renders and can still be claimed — nothing here can block that.
    expect(hasAchievementCopy('an_id_from_a_newer_server')).toBe(false)
    expect(achievementTitle('an_id_from_a_newer_server')).not.toBe('')
    expect(achievementBody('an_id_from_a_newer_server')).toBe('')
  })

  it('labels every axis the wire can carry', () => {
    for (const axis of Object.values(AchievementAxis)) {
      if (typeof axis !== 'number') continue
      expect(axisLabel(axis)).not.toBe('')
    }
  })
})
