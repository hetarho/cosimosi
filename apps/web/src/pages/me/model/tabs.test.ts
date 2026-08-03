import { describe, expect, it } from 'vitest'

import { ME_TABS } from './tabs.ts'

describe('me tabs', () => {
  it('keeps the fixed five-tab order', () => {
    expect(ME_TABS).toEqual(['profile', 'stardust', 'achievements', 'diary', 'account'])
  })
})
