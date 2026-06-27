import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { sessionMachine } from './session-machine.ts'

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
})
