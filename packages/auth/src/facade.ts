import { createActor } from 'xstate'

import type {
  AuthAdapter,
  AuthAdapterChange,
  AuthFacade,
  AuthSession,
  SignInCredentials,
} from './auth-adapter.ts'
import { readErrorMessage } from './error.ts'
import {
  holdsAccessToken,
  refreshAllowed,
  restorePoint,
  sessionMachine,
  type SessionEvent,
} from './session-machine.ts'
import type { SessionSnapshot } from './session.ts'

export interface CreateAuthFacadeOptions {
  adapter: AuthAdapter
}

/**
 * Wire an AuthAdapter to the XState session machine. The adapter owns IO (Supabase client, secure
 * storage, network) and reports adapter-side changes; the machine decides which of them apply, and
 * this façade only issues the adapter calls and exposes the resulting SessionSnapshot plus the
 * transport-facing token accessor. Platform-pure — both web and mobile providers call this from a
 * React context; tests can call it directly.
 *
 * Every operation takes the next `epoch` when it starts, and its settlement reaches the machine only
 * while that epoch is still current, so a later operation, a sign-out or disposal fences it. The
 * machine moves the epoch too, through `fence`, when it ends a session on its own.
 */
export function createAuthFacade({ adapter }: CreateAuthFacadeOptions): AuthFacade {
  let epoch = 0
  const actor = createActor(
    sessionMachine.provide({
      actions: {
        fence: () => {
          epoch += 1
        },
      },
    }),
  )
  actor.start()
  const running = () => actor.getSnapshot().status === 'active'
  const send = (event: SessionEvent) => {
    if (running()) actor.send(event)
  }

  const adapterUnsubscribe = adapter.onChange((snapshot, change) => {
    const event = adapterEvent(snapshot, change)
    if (event) send(event)
  })

  const bootstrapEpoch = epoch
  void (async () => {
    try {
      const session = await adapter.bootstrap()
      if (bootstrapEpoch === epoch) {
        send({
          type: 'BOOTSTRAP_DONE',
          userId: session?.userId ?? null,
          expiresAt: session?.expiresAt ?? null,
        })
      }
    } catch (error) {
      if (bootstrapEpoch === epoch) send({ type: 'BOOTSTRAP_FAILURE', error: errorMessage(error) })
    } finally {
      send({ type: 'BOOTSTRAP_SETTLED' })
    }
  })()

  // One sign-in attempt: start it, await the adapter, and settle it only if nothing fenced it since.
  async function attempt<T>(
    start: Extract<SessionEvent, { type: 'SIGN_IN_START' }>,
    call: () => Promise<T>,
    settled: (result: T) => SessionEvent,
  ): Promise<T> {
    const operationEpoch = ++epoch
    send(start)
    try {
      const result = await call()
      if (operationEpoch === epoch) send(settled(result))
      return result
    } catch (error) {
      if (operationEpoch === epoch) send({ type: 'SIGN_IN_FAILURE', error: errorMessage(error) })
      throw error
    }
  }

  return {
    get snapshot(): SessionSnapshot {
      return actor.getSnapshot().context
    },
    async signIn(credentials: SignInCredentials) {
      await attempt({ type: 'SIGN_IN_START' }, () => adapter.signIn(credentials), signedIn)
    },
    async signUpWithPassword(credentials: SignInCredentials) {
      // Email confirmation is an expected successful credential-creation outcome: the session
      // settles back to signedOut, and the local signup machine owns the confirmationSent copy.
      const session = await attempt(
        { type: 'SIGN_IN_START' },
        () => adapter.signUpWithPassword(credentials),
        (result) => (result ? signedIn(result) : { type: 'SIGN_OUT' }),
      )
      return session ? ('signedIn' as const) : ('confirmationRequired' as const)
    },
    async signInWithGoogle() {
      // A null session means the flow continues outside the app (web full-page redirect, mobile
      // system browser); the machine holds `signingIn` until the adapter's report, a completion
      // call or a cancel settles it.
      await attempt(
        { type: 'SIGN_IN_START', external: true },
        () => adapter.signInWithGoogle(),
        (session) => (session ? signedIn(session) : { type: 'SIGN_IN_LEFT_APP' }),
      )
    },
    async completeOAuthSignIn(callbackUrl: string) {
      // A completion can arrive after cancelSignIn returned the machine to `signedOut`; starting a
      // new attempt re-enters `signingIn` from there too.
      await attempt(
        { type: 'SIGN_IN_START' },
        () => adapter.completeOAuthSignIn(callbackUrl),
        signedIn,
      )
    },
    cancelSignIn() {
      send({ type: 'CANCEL_SIGN_IN' })
    },
    async signOut() {
      const previousEpoch = epoch
      const restore = restorePoint(actor.getSnapshot())
      const operationEpoch = ++epoch
      send({ type: 'SIGN_OUT' })
      try {
        await adapter.signOut()
      } catch (error) {
        if (operationEpoch === epoch) {
          epoch = previousEpoch
          send(restore)
        }
        throw error
      }
    },
    forceLocalSignOut() {
      epoch += 1
      send({ type: 'SIGN_OUT', forced: true })
    },
    async refresh() {
      if (!refreshAllowed(actor.getSnapshot())) return
      const operationEpoch = ++epoch
      send({ type: 'REFRESH_START' })
      try {
        const session = await adapter.refresh()
        if (operationEpoch === epoch) {
          send({ type: 'REFRESH_SUCCESS', userId: session.userId, expiresAt: session.expiresAt })
        }
      } catch (error) {
        if (operationEpoch === epoch) send({ type: 'REFRESH_FAILURE', error: errorMessage(error) })
        throw error
      }
    },
    getAccessToken() {
      if (!holdsAccessToken(actor.getSnapshot())) return Promise.resolve(null)
      return adapter
        .getAccessToken()
        .then((token) => (holdsAccessToken(actor.getSnapshot()) ? token : null))
        .catch(() => null)
    },
    subscribe(listener) {
      if (!running()) return () => {}
      const subscription = actor.subscribe((snapshot) => listener(snapshot.context))
      return () => subscription.unsubscribe()
    },
    dispose() {
      if (!running()) return
      epoch += 1
      adapterUnsubscribe()
      actor.send({ type: 'DISPOSE' })
      adapter.dispose?.()
    },
  }
}

function signedIn(session: AuthSession): SessionEvent {
  return { type: 'SIGN_IN_SUCCESS', userId: session.userId, expiresAt: session.expiresAt }
}

// What the adapter reported, as the machine event that may apply it.
function adapterEvent(snapshot: SessionSnapshot, change: AuthAdapterChange): SessionEvent | null {
  switch (snapshot.status) {
    case 'signedOut':
      return { type: 'ADAPTER_SIGNED_OUT' }
    case 'expired':
      return { type: 'ADAPTER_EXPIRED' }
    case 'authenticated':
      return snapshot.userId && snapshot.expiresAt !== null
        ? {
            type: 'ADAPTER_AUTHENTICATED',
            userId: snapshot.userId,
            expiresAt: snapshot.expiresAt,
            refreshed: change.source === 'tokenRefreshed',
          }
        : null
    default:
      return null
  }
}

function errorMessage(error: unknown): string {
  return readErrorMessage(error, 'unknown auth error')
}
