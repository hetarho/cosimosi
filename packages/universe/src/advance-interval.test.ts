import { describe, expect, it } from 'vitest'

import {
  UNIVERSE_TIME_ACCELERATION,
  advanceAnnouncementFromLaunch,
  advanceDurationMs,
  advanceSweepFrame,
  isEmptyAdvance,
  mergeAdvanceAnnouncements,
  sampleAdvanceDate,
} from './advance-interval.ts'

describe('isEmptyAdvance', () => {
  it('is empty when the clock did not move (past-dated / same-day launch)', () => {
    expect(isEmptyAdvance({ previous: '2026-07-01', current: '2026-07-01' })).toBe(true)
  })

  it('is non-empty when the clock advanced — including the first-ever launch', () => {
    expect(isEmptyAdvance({ previous: '2026-07-01', current: '2026-07-08' })).toBe(false)
    expect(isEmptyAdvance({ previous: null, current: '2026-07-08' })).toBe(false)
  })
})

describe('advanceDurationMs', () => {
  it('reads the floor for a first launch and near-floor for a one-day step', () => {
    expect(advanceDurationMs({ previous: null, current: '2026-07-08' })).toBe(
      UNIVERSE_TIME_ACCELERATION.minDurationMs,
    )
    expect(advanceDurationMs({ previous: '2026-07-07', current: '2026-07-08' })).toBe(
      UNIVERSE_TIME_ACCELERATION.minDurationMs + UNIVERSE_TIME_ACCELERATION.perDayMs,
    )
  })

  it('grows with the jump but never past the cap', () => {
    const week = advanceDurationMs({ previous: '2026-07-01', current: '2026-07-08' })
    const year = advanceDurationMs({ previous: '2025-07-08', current: '2026-07-08' })
    expect(week).toBeGreaterThan(UNIVERSE_TIME_ACCELERATION.minDurationMs)
    expect(year).toBe(UNIVERSE_TIME_ACCELERATION.maxDurationMs)
  })

  it('floors at the minimum for a backwards or malformed interval (no negative/NaN duration)', () => {
    // A negative duration would make the rAF sweep never reach t=1 and strand the overlay.
    expect(advanceDurationMs({ previous: '2026-07-20', current: '2026-06-25' })).toBe(
      UNIVERSE_TIME_ACCELERATION.minDurationMs,
    )
    const malformed = advanceDurationMs({ previous: '2026-07-08T00:00:00Z', current: '2026-07-09' })
    expect(Number.isFinite(malformed)).toBe(true)
    expect(malformed).toBeGreaterThanOrEqual(UNIVERSE_TIME_ACCELERATION.minDurationMs)
  })
})

describe('advanceSweepFrame', () => {
  const interval = { previous: '2026-07-01', current: '2026-07-08' }

  it('runs the veil envelope 0 → peak → 0 and terminates at the duration', () => {
    const duration = advanceDurationMs(interval)
    expect(advanceSweepFrame(interval, 0)).toMatchObject({
      universeTime: '2026-07-01',
      done: false,
    })
    expect(advanceSweepFrame(interval, 0).veilIntensity).toBeCloseTo(0)
    expect(advanceSweepFrame(interval, duration / 2).veilIntensity).toBeCloseTo(1)
    const end = advanceSweepFrame(interval, duration)
    expect(end).toMatchObject({ universeTime: '2026-07-08', done: true })
    expect(end.veilIntensity).toBeCloseTo(0)
  })

  it('always terminates for a malformed interval instead of stranding the loop', () => {
    const malformed = { previous: '2026-07-08T00:00:00Z', current: '2026-07-09' }
    expect(advanceSweepFrame(malformed, advanceDurationMs(malformed)).done).toBe(true)
  })
})

describe('mergeAdvanceAnnouncements', () => {
  it('spans earliest previous → latest current and unions the reveal ids', () => {
    const merged = mergeAdvanceAnnouncements(
      { interval: { previous: '2026-07-01', current: '2026-07-05' }, revealNeuronIds: ['a'] },
      { interval: { previous: '2026-07-03', current: '2026-07-10' }, revealNeuronIds: ['b'] },
    )
    expect(merged.interval).toEqual({ previous: '2026-07-01', current: '2026-07-10' })
    expect(merged.revealNeuronIds).toEqual(['a', 'b'])
  })

  it('never inverts on out-of-order arrival — the earlier-committed interval keeps the span forward', () => {
    const merged = mergeAdvanceAnnouncements(
      { interval: { previous: '2026-07-20', current: '2026-07-21' }, revealNeuronIds: [] },
      { interval: { previous: '2026-06-01', current: '2026-06-25' }, revealNeuronIds: [] },
    )
    expect(merged.interval.previous! <= merged.interval.current).toBe(true)
    expect(merged.interval).toEqual({ previous: '2026-06-01', current: '2026-07-21' })
  })

  it('keeps a null previous (the unborn clock is earliest of all)', () => {
    const merged = mergeAdvanceAnnouncements(
      { interval: { previous: null, current: '2026-07-05' }, revealNeuronIds: [] },
      { interval: { previous: '2026-07-03', current: '2026-07-10' }, revealNeuronIds: [] },
    )
    expect(merged.interval.previous).toBeNull()
  })
})

describe('sampleAdvanceDate', () => {
  const interval = { previous: '2026-06-08', current: '2026-07-08' }

  it('lands exactly on the endpoints', () => {
    expect(sampleAdvanceDate(interval, 0)).toBe('2026-06-08')
    expect(sampleAdvanceDate(interval, 1)).toBe('2026-07-08')
  })

  it('advances monotonically between them', () => {
    let last = sampleAdvanceDate(interval, 0)
    for (let step = 1; step <= 20; step += 1) {
      const next = sampleAdvanceDate(interval, step / 20)
      expect(next >= last).toBe(true)
      last = next
    }
  })

  it('flips through at most maxDateSteps distinct dates on a long jump', () => {
    const long = { previous: '2025-07-08', current: '2026-07-08' }
    const seen = new Set<string>()
    for (let step = 0; step <= 1000; step += 1) seen.add(sampleAdvanceDate(long, step / 1000))
    expect(seen.size).toBeLessThanOrEqual(UNIVERSE_TIME_ACCELERATION.maxDateSteps + 1)
  })

  it('shows only the current date when there is no previous clock', () => {
    expect(sampleAdvanceDate({ previous: null, current: '2026-07-08' }, 0.5)).toBe('2026-07-08')
  })
})

describe('advanceAnnouncementFromLaunch', () => {
  it('announces the returned pair with the reveal ids on a clock-advancing launch', () => {
    const announcement = advanceAnnouncementFromLaunch({
      pastDated: false,
      previousUniverseTime: '2026-07-01',
      universeTime: '2026-07-08',
      newNeuronIds: ['n1', 'n2'],
    })
    expect(announcement).toEqual({
      interval: { previous: '2026-07-01', current: '2026-07-08' },
      revealNeuronIds: ['n1', 'n2'],
    })
  })

  it('maps the first-ever launch (empty previous) to a null-previous interval', () => {
    const announcement = advanceAnnouncementFromLaunch({
      pastDated: false,
      previousUniverseTime: '',
      universeTime: '2026-07-08',
      newNeuronIds: ['n1'],
    })
    expect(announcement?.interval).toEqual({ previous: null, current: '2026-07-08' })
  })

  it('announces nothing for a past-dated launch (the unmoved clock echoed twice)', () => {
    expect(
      advanceAnnouncementFromLaunch({
        pastDated: true,
        previousUniverseTime: '2026-07-08',
        universeTime: '2026-07-08',
        newNeuronIds: [],
      }),
    ).toBeNull()
  })

  it('announces nothing for a same-day launch — memories exist but no time passed', () => {
    expect(
      advanceAnnouncementFromLaunch({
        pastDated: false,
        previousUniverseTime: '2026-07-08',
        universeTime: '2026-07-08',
        newNeuronIds: ['n1'],
      }),
    ).toBeNull()
  })
})
