import { describe, expect, it } from 'vitest'

import { elapsedUniverseDays } from './universe-time.ts'

describe('elapsedUniverseDays', () => {
  it('counts whole days between two universe dates', () => {
    expect(elapsedUniverseDays('2026-01-01', '2026-01-11')).toBe(10)
  })

  it('floors at 0 for a null now, a future reference, or an unparseable input', () => {
    expect(elapsedUniverseDays('2026-01-01', null)).toBe(0)
    expect(elapsedUniverseDays('2026-06-01', '2026-01-01')).toBe(0)
    expect(elapsedUniverseDays('not-a-date', '2026-01-01')).toBe(0)
  })
})
