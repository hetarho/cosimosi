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
    signedOut: 'login',
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

  it('sends every signed-out status to the same door', () => {
    // The root is the way in, and the page that introduces the product has its own address — so no
    // signed-out status resolves to a surface any other signed-out status does not.
    const door = (Object.keys(cases) as SessionStatus[]).filter(
      (status) => gateDecision(status) === 'login',
    )
    expect(door).toEqual(['signedOut', 'signingIn', 'expired', 'failed'])
  })

  it('has no marketing arm left to resolve to', () => {
    // The `'landing'` decision retired with the marketing page's move off `/`; a status quietly
    // mapping back to it would mean the root means two things again.
    const decisions = (Object.keys(cases) as SessionStatus[]).map(gateDecision)
    expect([...new Set(decisions)].sort()).toEqual(['hold', 'login', 'universe'])
  })
})

describe('requiresSignIn', () => {
  // The structural guard every consumer asks through instead of comparing to 'login', so the day a
  // fourth decision arrives the exhaustive switch refuses to compile rather than letting a signed-out
  // visitor through four separate `=== 'login'` checks.
  const cases: Record<GateDecision, boolean> = {
    login: true,
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
    expect(signedOutDecisions.sort()).toEqual(['login'])
  })
})
