import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import {
  holdsAccessToken,
  refreshAllowed,
  restorePoint,
  sessionMachine,
} from './session-machine.ts'

describe('session machine', () => {
  it('transitions bootstrapping → authenticated on bootstrap with a user id', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-1', expiresAt: 1234 })
    const snapshot = actor.getSnapshot().context
    expect(snapshot.status).toBe('authenticated')
    expect(snapshot.userId).toBe('user-1')
    expect(snapshot.expiresAt).toBe(1234)
    expect(snapshot.error).toBeNull()
    actor.stop()
  })

  it('transitions bootstrapping → signedOut on anonymous bootstrap', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: null, expiresAt: null })
    expect(actor.getSnapshot().context.status).toBe('signedOut')
    expect(actor.getSnapshot().context.userId).toBeNull()
    actor.stop()
  })

  it('transitions bootstrapping → failed on bootstrap failure', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_FAILURE', error: 'storage unavailable' })
    expect(actor.getSnapshot().context.status).toBe('failed')
    expect(actor.getSnapshot().context.error).toBe('storage unavailable')
    actor.stop()
  })

  it('walks the signing-in → authenticated lifecycle', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: null, expiresAt: null })
    actor.send({ type: 'SIGN_IN_START' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    actor.send({ type: 'SIGN_IN_SUCCESS', userId: 'user-2', expiresAt: 9999 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().context.userId).toBe('user-2')
    actor.stop()
  })

  it('allows sign-in to start before bootstrap finishes', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'SIGN_IN_START' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    actor.send({ type: 'SIGN_IN_SUCCESS', userId: 'user-early', expiresAt: 123 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().context.userId).toBe('user-early')
    actor.stop()
  })

  it('records sign-in failures and lets the user retry from failed', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: null, expiresAt: null })
    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'SIGN_IN_FAILURE', error: 'bad password' })
    expect(actor.getSnapshot().context.status).toBe('failed')
    expect(actor.getSnapshot().context.error).toBe('bad password')
    actor.send({ type: 'SIGN_IN_START' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    actor.stop()
  })

  it('refreshes from authenticated and returns to authenticated', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-3', expiresAt: 1 })
    actor.send({ type: 'REFRESH_START' })
    expect(actor.getSnapshot().context.status).toBe('refreshing')
    expect(actor.getSnapshot().context.userId).toBe('user-3')
    actor.send({ type: 'REFRESH_SUCCESS', userId: 'user-3', expiresAt: 2 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().context.userId).toBe('user-3')
    expect(actor.getSnapshot().context.expiresAt).toBe(2)
    actor.stop()
  })

  it('allows refresh to complete before bootstrap finishes', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'REFRESH_START' })
    expect(actor.getSnapshot().context.status).toBe('refreshing')
    actor.send({ type: 'REFRESH_SUCCESS', userId: 'user-refresh', expiresAt: 2 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().context.userId).toBe('user-refresh')
    actor.stop()
  })

  it('keeps authenticated identity when refresh fails after a known session', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-3', expiresAt: 1 })
    actor.send({ type: 'REFRESH_START' })
    actor.send({ type: 'REFRESH_FAILURE', error: 'network unavailable' })
    const snapshot = actor.getSnapshot().context
    expect(snapshot.status).toBe('authenticated')
    expect(snapshot.userId).toBe('user-3')
    expect(snapshot.expiresAt).toBe(1)
    expect(snapshot.error).toBe('network unavailable')
    actor.stop()
  })

  it('moves to expired on EXPIRED and allows re-sign-in', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-4', expiresAt: 1 })
    actor.send({ type: 'EXPIRED' })
    expect(actor.getSnapshot().context.status).toBe('expired')
    expect(actor.getSnapshot().context.userId).toBeNull()
    actor.send({ type: 'SIGN_IN_START' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    actor.stop()
  })

  it('signs out from any authed-adjacent state', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-5', expiresAt: 1 })
    actor.send({ type: 'SIGN_OUT' })
    expect(actor.getSnapshot().context.status).toBe('signedOut')
    expect(actor.getSnapshot().context.userId).toBeNull()
    expect(actor.getSnapshot().context.expiresAt).toBeNull()
    actor.stop()
  })

  it('does not let expiration events strand an in-flight sign-in', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: null, expiresAt: null })
    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'EXPIRED' })
    actor.send({ type: 'SIGN_IN_SUCCESS', userId: 'user-7', expiresAt: 7 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().context.userId).toBe('user-7')
    actor.stop()
  })

  it('preserves only serializable control data in context', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: 'user-6', expiresAt: 1 })
    const snapshot = actor.getSnapshot().context
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    actor.stop()
  })

  it('keeps the context to the four session fields whatever the internal regions hold', () => {
    const actor = createActor(sessionMachine)
    actor.start()
    actor.send({ type: 'SIGN_IN_START', external: true })
    actor.send({ type: 'SIGN_OUT', forced: true })
    expect(Object.keys(actor.getSnapshot().context).sort()).toEqual([
      'error',
      'expiresAt',
      'status',
      'userId',
    ])
    actor.stop()
  })
})

// The facade's control paths, driven event by event. `fence` stands in for the facade's epoch: it
// counts the in-flight operations the machine invalidated on its own.
describe('session machine — sign-in attempts, sign-out and disposal', () => {
  function start() {
    let fences = 0
    const actor = createActor(
      sessionMachine.provide({
        actions: {
          fence: () => {
            fences += 1
          },
        },
      }),
    )
    actor.start()
    actor.send({ type: 'BOOTSTRAP_DONE', userId: null, expiresAt: null })
    actor.send({ type: 'BOOTSTRAP_SETTLED' })
    return { actor, fences: () => fences }
  }

  it('a duplicate sign-in keeps one awaited call and ignores the adapter reporting no session', () => {
    const { actor, fences } = start()
    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'SIGN_IN_START' })
    expect(actor.getSnapshot().matches({ running: { attempt: 'inCall' } })).toBe(true)

    actor.send({ type: 'ADAPTER_SIGNED_OUT' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    expect(fences()).toBe(0)

    actor.send({ type: 'SIGN_IN_SUCCESS', userId: 'user', expiresAt: 10 })
    expect(actor.getSnapshot().context.status).toBe('authenticated')
    expect(actor.getSnapshot().matches({ running: { attempt: 'idle' } })).toBe(true)
    actor.stop()
  })

  it('an OAuth flow outside the app settles on the adapter report and can be cancelled before it', () => {
    const { actor, fences } = start()
    actor.send({ type: 'SIGN_IN_START', external: true })
    actor.send({ type: 'SIGN_IN_LEFT_APP' })
    expect(actor.getSnapshot().matches({ running: { attempt: 'outsideApp' } })).toBe(true)

    // A refreshed-token report is suppressed while the attempt is open; the return's own report applies.
    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'g', expiresAt: 5, refreshed: true })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'g', expiresAt: 5, refreshed: false })
    expect(actor.getSnapshot().context).toMatchObject({ status: 'authenticated', userId: 'g' })

    actor.send({ type: 'SIGN_OUT' })
    actor.send({ type: 'SIGN_IN_START', external: true })
    actor.send({ type: 'CANCEL_SIGN_IN' })
    expect(actor.getSnapshot().context.status).toBe('signedOut')
    expect(fences()).toBe(1)

    // A password attempt is never cancelled.
    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'CANCEL_SIGN_IN' })
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    expect(fences()).toBe(1)
    actor.stop()
  })

  it('a forced local sign-out refuses adapter sessions and refresh until a sign-in succeeds', () => {
    const { actor } = start()
    actor.send({ type: 'AUTHENTICATED', userId: 'u', expiresAt: 10 })
    actor.send({ type: 'SIGN_OUT', forced: true })
    expect(refreshAllowed(actor.getSnapshot())).toBe(false)
    expect(holdsAccessToken(actor.getSnapshot())).toBe(false)

    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'u', expiresAt: 11, refreshed: false })
    expect(actor.getSnapshot().context.status).toBe('signedOut')

    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'SIGN_IN_SUCCESS', userId: 'u', expiresAt: 12 })
    expect(refreshAllowed(actor.getSnapshot())).toBe(true)
    expect(holdsAccessToken(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it('a refresh after a local sign-out cannot revive the session, but a cross-tab sign-in can', () => {
    const { actor } = start()
    actor.send({ type: 'AUTHENTICATED', userId: 'u', expiresAt: 10 })
    const restore = restorePoint(actor.getSnapshot())
    actor.send({ type: 'SIGN_OUT' })

    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'u', expiresAt: 11, refreshed: true })
    expect(actor.getSnapshot().context.status).toBe('signedOut')
    expect(refreshAllowed(actor.getSnapshot())).toBe(true)

    // A failed sign-out puts the session and its access back.
    actor.send(restore)
    expect(actor.getSnapshot().context).toMatchObject({ status: 'authenticated', userId: 'u' })
    expect(holdsAccessToken(actor.getSnapshot())).toBe(true)

    actor.send({ type: 'SIGN_OUT' })
    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'other', expiresAt: 20, refreshed: false })
    expect(actor.getSnapshot().context).toMatchObject({ status: 'authenticated', userId: 'other' })
    actor.stop()
  })

  it('an adapter report of no session before the bootstrap settles signs out and fences it', () => {
    let fences = 0
    const actor = createActor(
      sessionMachine.provide({ actions: { fence: () => void (fences += 1) } }),
    )
    actor.start()
    actor.send({ type: 'ADAPTER_AUTHENTICATED', userId: 'u', expiresAt: 1, refreshed: false })
    expect(actor.getSnapshot().context.status).toBe('bootstrapping')
    actor.send({ type: 'ADAPTER_EXPIRED' })
    expect(actor.getSnapshot().context.status).toBe('signedOut')
    expect(fences).toBe(1)
    actor.stop()
  })

  it('disposal during a sign-in ends the machine and keeps the last snapshot', () => {
    const { actor } = start()
    actor.send({ type: 'SIGN_IN_START' })
    actor.send({ type: 'DISPOSE' })
    expect(actor.getSnapshot().status).toBe('done')
    expect(actor.getSnapshot().context.status).toBe('signingIn')
    expect(refreshAllowed(actor.getSnapshot())).toBe(false)
    expect(holdsAccessToken(actor.getSnapshot())).toBe(false)
  })
})
