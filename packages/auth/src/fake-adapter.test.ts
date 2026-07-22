import { describe, expect, it } from 'vitest'

import type { AuthSession } from './auth-adapter.ts'
import { FakeAuthAdapter } from './fake-adapter.ts'

describe('FakeAuthAdapter', () => {
  it('bootstraps null when no initial session is provided', async () => {
    const adapter = new FakeAuthAdapter()
    expect(await adapter.bootstrap()).toBeNull()
  })

  it('signs in with email/password and emits an authenticated snapshot', async () => {
    const events: Array<{ userId: string | null }> = []
    const adapter = new FakeAuthAdapter()
    adapter.onChange((snapshot) => events.push(snapshot))
    const session = await adapter.signIn({ email: 'a@b.co', password: 'pw' })
    expect(session.userId).toBe('fake-user-a@b.co')
    expect(events).toContainEqual(
      expect.objectContaining({ userId: session.userId, status: 'authenticated' }),
    )
  })

  it('rejects signIn when configured to fail', async () => {
    const adapter = new FakeAuthAdapter({ signInError: 'nope' })
    await expect(adapter.signIn({ email: 'a@b.co', password: 'pw' })).rejects.toThrow('nope')
  })

  it('resolves the Google flow in-call and emits an authenticated snapshot', async () => {
    const events: Array<{ userId: string | null; status: string }> = []
    const adapter = new FakeAuthAdapter()
    adapter.onChange((snapshot) => events.push(snapshot))
    const session = await adapter.signInWithGoogle()
    expect(session?.userId).toBe('fake-user-google')
    expect(events).toContainEqual(
      expect.objectContaining({ userId: 'fake-user-google', status: 'authenticated' }),
    )
  })

  it('completes an OAuth callback into an authenticated session', async () => {
    const adapter = new FakeAuthAdapter()
    const session = await adapter.completeOAuthSignIn('cosimosi://auth-callback?code=abc')
    expect(session.userId).toBe('fake-user-google')
    expect(await adapter.bootstrap()).toEqual(session)
  })

  it('rejects the Google flow when configured to fail', async () => {
    const adapter = new FakeAuthAdapter({ signInError: 'nope' })
    await expect(adapter.signInWithGoogle()).rejects.toThrow('nope')
    await expect(adapter.completeOAuthSignIn('cosimosi://auth-callback?code=x')).rejects.toThrow(
      'nope',
    )
  })

  it('refreshes the active session and extends expiry', async () => {
    const initial: AuthSession = { userId: 'u', expiresAt: 1 }
    const adapter = new FakeAuthAdapter({ initial })
    const before = (await adapter.bootstrap())?.expiresAt
    const refreshed = await adapter.refresh()
    expect(refreshed.expiresAt).toBeGreaterThan(before ?? 0)
  })

  it('returns null from getAccessToken when the session has expired', async () => {
    const past: AuthSession = { userId: 'u', expiresAt: 1 }
    const adapter = new FakeAuthAdapter({ initial: past, now: () => 100 })
    expect(await adapter.getAccessToken()).toBeNull()
  })

  it('returns the access token while the session is live', async () => {
    const adapter = new FakeAuthAdapter({ now: () => 0 })
    await adapter.signIn({ email: 'a@b.co', password: 'pw' })
    expect(await adapter.getAccessToken()).toMatch(/^fake-token-/)
  })

  it('emits signedOut when signOut completes', async () => {
    const adapter = new FakeAuthAdapter({ initial: { userId: 'u', expiresAt: 999 } })
    const events: string[] = []
    adapter.onChange((snapshot) => events.push(snapshot.status))
    await adapter.signOut()
    expect(events).toContain('signedOut')
    expect(await adapter.bootstrap()).toBeNull()
  })
})
