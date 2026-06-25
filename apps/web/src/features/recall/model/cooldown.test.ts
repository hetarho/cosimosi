import { describe, expect, it } from 'vitest'
import { RECALL_COOLDOWN_MS, recallCooldownRemainingMs } from './cooldown'

const NOW = 1_700_000_000_000

describe('recall cooldown gate (change 35)', () => {
  it('a never-recalled star (recallCount ≤ 1) is always recallable — first recall', () => {
    expect(recallCooldownRemainingMs(1, NOW, NOW)).toBe(0)
    expect(recallCooldownRemainingMs(0, NOW, NOW)).toBe(0)
  })

  it('within the cooldown, returns the remaining time', () => {
    const elapsed = RECALL_COOLDOWN_MS / 3
    expect(recallCooldownRemainingMs(2, NOW - elapsed, NOW)).toBe(RECALL_COOLDOWN_MS - elapsed)
  })

  it('once the cooldown has elapsed, returns 0 (recall allowed again)', () => {
    expect(recallCooldownRemainingMs(2, NOW - RECALL_COOLDOWN_MS, NOW)).toBe(0)
    expect(recallCooldownRemainingMs(5, NOW - RECALL_COOLDOWN_MS * 2, NOW)).toBe(0)
  })
})
