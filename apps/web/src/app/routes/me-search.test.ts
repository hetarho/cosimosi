import { describe, expect, it } from 'vitest'

import { parseMeSearch, parseMeTab } from './me-search.ts'

describe('me tab search', () => {
  // `toString`/`__proto__` are the reason the lookup uses `Object.hasOwn` rather than `in`: an
  // inherited key accepted as a tab id would hand the page a panel it does not have.
  it.each([undefined, null, '', 'unknown', 'toString', '__proto__', 'constructor'])(
    'coerces %s to profile',
    (value) => {
      expect(parseMeTab(value)).toBe('profile')
    },
  )

  it('keeps a valid deep-linked tab', () => {
    expect(parseMeTab('achievements')).toBe('achievements')
  })

  // Validate-or-drop: an unusable key never reaches the screen. It is dropped from the match's search,
  // not from the address bar — the raw query survives a cold load until a navigation replaces it.
  it.each([{ tab: 'sideways' }, {}, { tab: 7 }])('drops the unusable key in %o', (search) => {
    expect(parseMeSearch(search)).toEqual({ tab: undefined })
  })

  it('keeps a usable tab key', () => {
    expect(parseMeSearch({ tab: 'stardust' })).toEqual({ tab: 'stardust' })
  })
})
