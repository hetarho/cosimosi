import { describe, expect, it } from 'vitest'

import { ME_TABS, parseMeTab } from './tabs.ts'

describe('me tab search', () => {
  it('keeps the fixed five-tab order', () => {
    expect(ME_TABS).toEqual(['profile', 'stardust', 'achievements', 'diary', 'account'])
  })

  it.each([undefined, null, '', 'unknown'])('coerces %s to profile', (value) => {
    expect(parseMeTab(value)).toBe('profile')
  })

  it('keeps a valid deep-linked tab', () => {
    expect(parseMeTab('achievements')).toBe('achievements')
  })
})
