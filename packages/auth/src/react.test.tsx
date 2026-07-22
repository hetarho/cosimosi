import { describe, expect, it } from 'vitest'

import { authScopeKey } from './react.ts'

describe('authScopeKey', () => {
  it('uses authenticated user ids as stable isolation scopes', () => {
    expect(authScopeKey({ userId: 'user-a' })).toBe('user-a')
    expect(authScopeKey({ userId: 'user-b' })).toBe('user-b')
  })

  it('collapses every unauthenticated session state into one anonymous scope', () => {
    expect(authScopeKey({ userId: null })).toBe('anonymous')
  })
})
