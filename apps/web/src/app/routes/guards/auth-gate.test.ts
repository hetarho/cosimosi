import { isRedirect, type ParsedLocation } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import type { SessionStatus } from '@cosimosi/auth'

import { authGuardBeforeLoad, loginReturnTarget } from './auth-gate.ts'

// A minimal parsed location — the guard only reads `pathname` (where the user was headed) to carry
// it through as the login `from`.
function locationAt(pathname: string): ParsedLocation {
  return { pathname } as ParsedLocation
}

function runGuard(status: SessionStatus, pathname = '/'): unknown {
  try {
    authGuardBeforeLoad(() => status, locationAt(pathname))
    return undefined
  } catch (thrown) {
    return thrown
  }
}

describe('authGuardBeforeLoad', () => {
  // A1/A7: a settled signed-out session redirects to /login and carries where it was headed, so a
  // successful sign-in can return there. `failed` is a signed-out user, not an error screen.
  for (const status of ['signedOut', 'signingIn', 'expired', 'failed'] as const) {
    it(`redirects a ${status} session to /login carrying from`, () => {
      const thrown = runGuard(status, '/diary')
      expect(isRedirect(thrown)).toBe(true)
      expect(thrown).toMatchObject({ options: { to: '/login', search: { from: '/diary' } } })
    })
  }

  // A1: bootstrapping/refreshing HOLD in place (no redirect — no signed-out flash), and an
  // authenticated session passes straight through to the universe.
  for (const status of ['bootstrapping', 'refreshing', 'authenticated'] as const) {
    it(`does not redirect a ${status} session`, () => {
      expect(runGuard(status)).toBeUndefined()
    })
  }
})

describe('loginReturnTarget', () => {
  it('returns a carried internal pathname', () => {
    expect(loginReturnTarget('/diary')).toBe('/diary')
  })

  it('falls back to the universe when nothing was carried', () => {
    expect(loginReturnTarget(undefined)).toBe('/')
  })

  // `from` is user-visible URL input: reject anything that is not an internal single-slash
  // pathname, and never return to /login itself (a crafted from must not pin a signed-in user
  // to the login screen).
  for (const hostile of ['/login', '//evil.example', 'https://evil.example', 'diary', '']) {
    it(`rejects ${JSON.stringify(hostile)} back to the universe`, () => {
      expect(loginReturnTarget(hostile)).toBe('/')
    })
  }
})
