import { describe, expect, it } from 'vitest'

import { gateDecision, type GateDecision } from './gate-decision.ts'
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
})
