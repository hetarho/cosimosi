import { describe, expect, it } from 'vitest'

import { gateDecision, requiresSignIn, type GateDecision } from './gate-decision.ts'
import type { SessionStatus } from './session.ts'

describe('gateDecision', () => {
  // The whole gate rule, pinned over every SessionStatus so a new status can't slip through
  // unmapped and default a signed-out user into the universe (or a refresh into a login flash).
  const cases: Record<SessionStatus, GateDecision> = {
    authenticated: 'universe',
    bootstrapping: 'hold',
    refreshing: 'hold',
    signedOut: 'landing',
    signingIn: 'login',
    expired: 'login',
    failed: 'login',
  }

  for (const [status, decision] of Object.entries(cases) as [SessionStatus, GateDecision][]) {
    it(`maps ${status} → ${decision}`, () => {
      expect(gateDecision(status)).toBe(decision)
    })
  }

  it('holds on refreshing (never a login flash) — refreshing is provisionally authenticated', () => {
    expect(gateDecision('refreshing')).toBe('hold')
    expect(gateDecision('refreshing')).not.toBe('login')
  })

  it('routes a failed session to login, not an error screen', () => {
    expect(gateDecision('failed')).toBe('login')
  })

  it('sends only a settled signed-out visitor to the landing page', () => {
    // A returning user whose token died is not a marketing arrival, and a pending sign-in belongs on
    // the surface it started from. Exactly one status opens the front door.
    const landing = (Object.keys(cases) as SessionStatus[]).filter(
      (status) => gateDecision(status) === 'landing',
    )
    expect(landing).toEqual(['signedOut'])
  })
})

describe('requiresSignIn', () => {
  // The structural guard for widening the union: every consumer asks this instead of comparing to
  // 'login', so the day a fifth decision arrives the exhaustive switch refuses to compile rather than
  // letting a signed-out visitor through four separate `=== 'login'` checks.
  const cases: Record<GateDecision, boolean> = {
    login: true,
    landing: true,
    universe: false,
    hold: false,
  }

  for (const [decision, expected] of Object.entries(cases) as [GateDecision, boolean][]) {
    it(`${decision} → ${expected}`, () => {
      expect(requiresSignIn(decision)).toBe(expected)
    })
  }

  it('is true for every decision a signed-out person can reach, and no other', () => {
    const signedOutDecisions = (Object.keys(cases) as GateDecision[]).filter(requiresSignIn)
    expect(signedOutDecisions.sort()).toEqual(['landing', 'login'])
  })
})
