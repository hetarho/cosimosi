import { describe, expect, it } from 'vitest'

import { ME_TABS } from './tabs.ts'

describe('me tabs', () => {
  it('keeps the fixed six-tab order', () => {
    expect(ME_TABS).toEqual([
      'profile',
      'mood-colors',
      'stardust',
      'achievements',
      'diary',
      'account',
    ])
  })
})
