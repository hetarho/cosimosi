import { describe, expect, it } from 'vitest'

import type { AuthAdapter, AuthSession } from './auth-adapter.ts'
import { FakeAuthAdapter } from './fake-adapter.ts'
import { createAuthFacade } from './facade.ts'

describe('createAuthFacade', () => {
  it('bootstraps from the adapter without leaking tokens into the snapshot', async () => {
    const facade = createAuthFacade({
      adapter: new FakeAuthAdapter({
        initial: { userId: 'user-1', expiresAt: 1234 },
        accessToken: () => 'secret-token',
      }),
    })

    await flush()

    expect(facade.snapshot).toEqual({
      status: 'authenticated',
      userId: 'user-1',
      expiresAt: 1234,
      error: null,
    })
    expect(JSON.stringify(facade.snapshot)).not.toContain('secret-token')
  })

  it('signs in, refreshes, and signs out through the adapter contract', async () => {
    const adapter = new FakeAuthAdapter({ now: () => 1000 })
    const facade = createAuthFacade({ adapter })

    await flush()
    await facade.signIn({ email: 'a@b.co', password: 'pw' })
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('fake-user-a@b.co')
    expect(await facade.getAccessToken()).toBe('fake-token-fake-user-a@b.co')

    await facade.refresh()
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.expiresAt).toBe(61_000)

    await facade.signOut()
    expect(facade.snapshot.status).toBe('signedOut')
    expect(await facade.getAccessToken()).toBeNull()
  })

  it('surfaces bootstrap failures as failed session snapshots', async () => {
    const facade = createAuthFacade({
      adapter: new FakeAuthAdapter({ bootstrapError: 'storage unavailable' }),
    })

    await flush()

    expect(facade.snapshot.status).toBe('failed')
    expect(facade.snapshot.error).toBe('storage unavailable')
  })

  it('allows sign-in to complete while bootstrap is still pending', async () => {
    const bootstrap = deferred<AuthSession | null>()
    const base = new FakeAuthAdapter()
    const adapter: AuthAdapter = {
      bootstrap: () => bootstrap.promise,
      signIn: (credentials) => base.signIn(credentials),
      signOut: () => base.signOut(),
      refresh: () => base.refresh(),
      getAccessToken: () => base.getAccessToken(),
      onChange: (listener) => base.onChange(listener),
    }
    const facade = createAuthFacade({ adapter })

    await facade.signIn({ email: 'a@b.co', password: 'pw' })
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('fake-user-a@b.co')

    bootstrap.resolve(null)
    await flush()

    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('fake-user-a@b.co')
  })

  it.each(['signedOut', 'expired'] as const)(
    'does not lose %s adapter events while bootstrap is pending',
    async (status) => {
      const bootstrap = deferred<AuthSession | null>()
      let emit!: Parameters<AuthAdapter['onChange']>[0]
      const adapter: AuthAdapter = {
        bootstrap: () => bootstrap.promise,
        signIn: async () => ({ userId: 'unused', expiresAt: 1 }),
        signOut: async () => {},
        refresh: async () => ({ userId: 'unused', expiresAt: 1 }),
        getAccessToken: async () => 'stored-token',
        onChange: (listener) => {
          emit = listener
          return () => {}
        },
      }
      const facade = createAuthFacade({ adapter })

      emit({ status, userId: null, expiresAt: null, error: null }, { source: 'external' })
      bootstrap.resolve({ userId: 'bootstrap-user', expiresAt: 999 })
      await flush()

      expect(facade.snapshot.status).toBe('signedOut')
      expect(facade.snapshot.userId).toBeNull()
      await expect(facade.getAccessToken()).resolves.toBeNull()
    },
  )

  it('publishes adapter-driven expiration changes through subscriptions', async () => {
    const adapter = new FakeAuthAdapter({ initial: { userId: 'u', expiresAt: 999 } })
    const facade = createAuthFacade({ adapter })
    const statuses: string[] = []
    const unsubscribe = facade.subscribe((snapshot) => statuses.push(snapshot.status))

    await flush()
    adapter.emit({ status: 'expired', userId: null, expiresAt: null, error: null })

    expect(statuses).toContain('expired')
    expect(facade.snapshot.userId).toBeNull()
    unsubscribe()
  })

  it('does not expose access tokens while the session snapshot is expired', async () => {
    const adapter = new FakeAuthAdapter({
      initial: { userId: 'u', expiresAt: 999 },
      accessToken: () => 'stale-token',
    })
    const facade = createAuthFacade({ adapter })

    await flush()
    adapter.emit({ status: 'expired', userId: null, expiresAt: null, error: null })

    expect(facade.snapshot.status).toBe('expired')
    await expect(facade.getAccessToken()).resolves.toBeNull()
  })

  it('ignores late authenticated adapter events after local sign-out', async () => {
    const adapter = new FakeAuthAdapter({ initial: { userId: 'u', expiresAt: 999 } })
    const facade = createAuthFacade({ adapter })

    await flush()
    await facade.signOut()
    adapter.emit(
      { status: 'authenticated', userId: 'u', expiresAt: 1_000, error: null },
      'tokenRefreshed',
    )

    expect(facade.snapshot.status).toBe('signedOut')
    expect(facade.snapshot.userId).toBeNull()
  })

  it('restores local session state when adapter sign-out fails', async () => {
    const adapter = new FakeAuthAdapter({
      initial: { userId: 'u', expiresAt: 60_000 },
      signOutError: 'network unavailable',
      now: () => 1_000,
    })
    const facade = createAuthFacade({ adapter })

    await flush()

    await expect(facade.signOut()).rejects.toThrow('network unavailable')
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('u')
    await expect(facade.getAccessToken()).resolves.toBe('fake-token-u')

    adapter.emit(
      { status: 'authenticated', userId: 'u', expiresAt: 1_000, error: null },
      'tokenRefreshed',
    )
    expect(facade.snapshot.status).toBe('authenticated')

    adapter.emit(
      { status: 'authenticated', userId: 'u', expiresAt: 1_001, error: null },
      'signedIn',
    )
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('u')
  })

  it('keeps the authenticated snapshot when refresh fails transiently', async () => {
    const adapter = new FakeAuthAdapter({
      initial: { userId: 'u', expiresAt: 999 },
      refreshError: 'network unavailable',
    })
    const facade = createAuthFacade({ adapter })

    await flush()

    await expect(facade.refresh()).rejects.toThrow('network unavailable')
    expect(facade.snapshot.status).toBe('authenticated')
    expect(facade.snapshot.userId).toBe('u')
    expect(facade.snapshot.error).toBe('network unavailable')
  })

  it('returns null when token access fails so public transports can proceed anonymously', async () => {
    const adapter = new FakeAuthAdapter({ initial: { userId: 'u', expiresAt: 999 } })
    const throwingAdapter: AuthAdapter = {
      bootstrap: () => adapter.bootstrap(),
      signIn: (credentials) => adapter.signIn(credentials),
      signOut: () => adapter.signOut(),
      refresh: () => adapter.refresh(),
      getAccessToken: async () => {
        throw new Error('storage unavailable')
      },
      onChange: (listener) => adapter.onChange(listener),
    }
    const facade = createAuthFacade({ adapter: throwingAdapter })

    await flush()

    await expect(facade.getAccessToken()).resolves.toBeNull()
  })

  it('disposes the adapter subscription and actor', async () => {
    const adapter = new FakeAuthAdapter({ initial: { userId: 'u', expiresAt: 999 } })
    const facade = createAuthFacade({ adapter })
    const statuses: string[] = []
    facade.subscribe((snapshot) => statuses.push(snapshot.status))

    await flush()
    facade.dispose()
    adapter.emit({ status: 'expired', userId: null, expiresAt: null, error: null })

    expect(facade.snapshot.status).toBe('authenticated')
    expect(statuses).not.toContain('expired')
    await expect(facade.getAccessToken()).resolves.toBeNull()
    expect(facade.subscribe(() => statuses.push('disposed'))()).toBeUndefined()
    expect(statuses).not.toContain('disposed')
  })
})

async function flush(): Promise<void> {
  await Promise.resolve()
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}
