import { describe, expect, it } from 'vitest'

import { ME_TABS } from './tabs.ts'

describe('me tabs', () => {
  it('keeps the fixed five-tab order', () => {
    expect(ME_TABS).toEqual(['profile', 'mood-colors', 'stardust', 'achievements', 'diary'])
  })

  it('offers no 계정 tab — the account rows live at the foot of the profile', () => {
    // A link to the retired tab must not be a dead end: `parseMeTab` lands an unknown id on 프로필,
    // which is where the account rows now are.
    expect(ME_TABS).not.toContain('account')
  })
})
