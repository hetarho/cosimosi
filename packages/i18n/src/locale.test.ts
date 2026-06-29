import { afterEach, describe, expect, it } from 'vitest'

import {
  defaultLocale,
  getActiveLocale,
  m,
  matchLocale,
  resolveLocale,
  setActiveLocale,
  subscribeLocale,
  supportedLocales,
} from './index.ts'

// This suite runs in Vitest's default Node environment: no window, navigator, or
// document exist here, which is the point — locale resolution and message
// rendering must work without any browser globals.

afterEach(() => {
  setActiveLocale(defaultLocale)
})

describe('locale catalog', () => {
  it('ships English and Korean with English as the default', () => {
    expect([...supportedLocales]).toEqual(['en', 'ko'])
    expect(defaultLocale).toBe('en')
  })
})

describe('matchLocale', () => {
  it('matches an exact supported tag', () => {
    expect(matchLocale('ko')).toBe('ko')
  })

  it('matches case-insensitively and falls back to the primary subtag (both separators)', () => {
    expect(matchLocale('EN')).toBe('en')
    expect(matchLocale('en-US')).toBe('en')
    expect(matchLocale('ko-KR')).toBe('ko')
    expect(matchLocale('ko_KR')).toBe('ko') // device locales often use underscores
  })

  it('returns undefined for unsupported, empty, or missing tags', () => {
    expect(matchLocale('fr')).toBeUndefined()
    expect(matchLocale('')).toBeUndefined()
    expect(matchLocale(null)).toBeUndefined()
    expect(matchLocale(undefined)).toBeUndefined()
  })
})

describe('resolveLocale', () => {
  it('picks the first candidate that resolves to a supported locale', () => {
    expect(resolveLocale(['ko', 'en'])).toBe('ko')
    expect(resolveLocale([null, 'fr', 'en-GB'])).toBe('en')
  })

  it('falls back to the default when nothing matches', () => {
    expect(resolveLocale([])).toBe(defaultLocale)
    expect(resolveLocale([null, undefined, '', 'fr', 'de'])).toBe(defaultLocale)
  })
})

describe('active locale drives message functions', () => {
  it('renders messages in the active locale and notifies subscribers on real changes only', () => {
    // afterEach reset leaves the store at the English default.
    expect(getActiveLocale()).toBe('en')
    expect(m.app_greeting()).toBe('hello world')

    let notifications = 0
    const unsubscribe = subscribeLocale(() => {
      notifications += 1
    })

    setActiveLocale('ko')
    expect(getActiveLocale()).toBe('ko')
    expect(m.app_greeting()).toBe('안녕하세요')
    expect(m.common_retry()).toBe('다시 시도')
    expect(notifications).toBe(1)

    setActiveLocale('ko') // same value — deduped, no notification
    expect(notifications).toBe(1)

    setActiveLocale('en')
    expect(notifications).toBe(2)

    unsubscribe()
    setActiveLocale('ko') // no longer subscribed
    expect(notifications).toBe(2)
  })
})
