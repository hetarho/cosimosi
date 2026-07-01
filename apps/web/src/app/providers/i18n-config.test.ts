import { describe, expect, it } from 'vitest'

import { resolveWebLocale } from './i18n-config.ts'

// Runs in Vitest's Node environment — no window/navigator — proving web locale
// resolution is testable without browser globals.
describe('web locale resolution', () => {
  it('prefers a stored explicit choice over browser languages', () => {
    expect(resolveWebLocale({ stored: 'ko', languages: ['en-US'] })).toBe('ko')
  })

  it('falls back to browser languages in preference order', () => {
    expect(resolveWebLocale({ stored: null, languages: ['fr', 'ko-KR', 'en'] })).toBe('ko')
  })

  it('falls back to the default locale when nothing matches', () => {
    expect(resolveWebLocale({ stored: null, languages: ['fr', 'de'] })).toBe('en')
    expect(resolveWebLocale({})).toBe('en')
  })
})
