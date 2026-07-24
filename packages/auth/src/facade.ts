import { createActor, type Actor, type SnapshotFrom } from 'xstate'

import type { AuthAdapter, AuthFacade, SignInCredentials } from './auth-adapter.ts'
import { readErrorMessage } from './error.ts'
import { sessionMachine } from './session-machine.ts'
import type { SessionSnapshot } from './session.ts'

export interface CreateAuthFacadeOptions {
  adapter: AuthAdapter
}

/**
 * Wire an AuthAdapter to the XState session machine. The adapter owns IO (Supabase
 * client, secure storage, network) and emits adapter-side changes; this façade
 * translates those into machine events and exposes the resulting SessionSnapshot +
 * transport-facing token accessor. Platform-pure — both web and mobile providers
 * call this from a React context; tests can call it directly.
 *
 * The façade is single-threaded by design: machine events are dispatched in the
 * order the adapter/host invokes the methods, so the machine never observes a
 * refresh-success for a session that already signed out.
 */
export function createAuthFacade({ adapter }: CreateAuthFacadeOptions): AuthFacade {
  const actor: Actor<typeof sessionMachine> = createActor(sessionMachine)
  let epoch = 0
  let bootstrapped = false
  let disposed = false
  let locallySignedOut = false
  let suppressAdapterRefresh = false
  // True only between a Google flow leaving the app (adapter resolved null) and its
  // completion/abandonment. cancelSignIn is gated on it so a host's blanket
  // "foreground/pageshow → cancel" wiring can never abandon an in-flight password
  // sign-in that would still resolve.
  let externalOAuthPending = false
  // Count of in-flight sign-in operations (password/Google/OAuth-completion).
  let signInFlight = 0
  actor.start()

  // An adapter "signedOut" event only says "there is no session". While a sign-in
  // operation is in flight, or after one failed (`failed` holds the error the visitor
  // must see), that is already true — letting the event through would bump the epoch
  // (killing the in-flight operation's settlement) or clobber `failed` back to a
  // pristine signedOut form. Skipping is safe against the late-bootstrap-restore
  // hazard the SIGN_OUT normally guards: any sign-in operation already bumped the
  // epoch when it started, so a pending bootstrap can no longer apply.
  const signedOutEventIsRedundant = () =>
    signInFlight > 0 || actor.getSnapshot().context.status === 'failed'

  const adapterUnsubscribe = adapter.onChange((snapshot, change) => {
    if (disposed) return
    if (!bootstrapped && (snapshot.status === 'signedOut' || snapshot.status === 'expired')) {
      if (snapshot.status === 'signedOut' && signedOutEventIsRedundant()) return
      epoch += 1
      locallySignedOut = true
      suppressAdapterRefresh = true
      actor.send({ type: 'SIGN_OUT' })
      return
    }
    if (!bootstrapped) return
    switch (snapshot.status) {
      case 'signedOut':
        if (signedOutEventIsRedundant()) return
        epoch += 1
        locallySignedOut = true
        suppressAdapterRefresh = true
        actor.send({ type: 'SIGN_OUT' })
        break
      case 'authenticated':
        if (change.source === 'tokenRefreshed' && suppressAdapterRefresh) return
        if (snapshot.userId && snapshot.expiresAt !== null) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          externalOAuthPending = false
          actor.send({
            type: 'AUTHENTICATED',
            userId: snapshot.userId,
            expiresAt: snapshot.expiresAt,
          })
        }
        break
      case 'expired':
        if (!locallySignedOut) actor.send({ type: 'EXPIRED' })
        break
    }
  })

  const bootstrapEpoch = epoch
  void bootstrap(adapter, actor, {
    shouldApply: () => !disposed && bootstrapEpoch === epoch,
    didFinish: () => {
      if (disposed) return
      bootstrapped = true
    },
  })

  return {
    get snapshot(): SessionSnapshot {
      return actor.getSnapshot().context
    },
    async signIn(credentials: SignInCredentials) {
      const operationEpoch = ++epoch
      signInFlight += 1
      externalOAuthPending = false
      const previousSuppressAdapterRefresh = suppressAdapterRefresh
      suppressAdapterRefresh = true
      actor.send({ type: 'SIGN_IN_START' })
      try {
        const session = await adapter.signIn(credentials)
        if (!disposed && operationEpoch === epoch) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          actor.send({
            type: 'SIGN_IN_SUCCESS',
            userId: session.userId,
            expiresAt: session.expiresAt,
          })
        }
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          suppressAdapterRefresh = previousSuppressAdapterRefresh
          actor.send({ type: 'SIGN_IN_FAILURE', error: errorMessage(error) })
        }
        throw error
      } finally {
        signInFlight -= 1
      }
    },
    async signInWithGoogle() {
      const operationEpoch = ++epoch
      signInFlight += 1
      // Set BEFORE the await: the flow may leave the app inside adapter.signInWithGoogle()
      // (system browser open), and a fast foreground/`pageshow` can call cancelSignIn()
      // before that await resolves — the pending flag must already allow the abandon, or
      // the machine sits `signingIn` until the next foreground.
      externalOAuthPending = true
      const previousSuppressAdapterRefresh = suppressAdapterRefresh
      suppressAdapterRefresh = true
      actor.send({ type: 'SIGN_IN_START' })
      try {
        const session = await adapter.signInWithGoogle()
        if (!disposed && operationEpoch === epoch) {
          if (session) {
            externalOAuthPending = false
            locallySignedOut = false
            suppressAdapterRefresh = false
            actor.send({
              type: 'SIGN_IN_SUCCESS',
              userId: session.userId,
              expiresAt: session.expiresAt,
            })
          }
          // else: the flow continues outside the app (web full-page redirect / mobile
          // system browser) — the machine holds `signingIn` and settles later via the
          // adapter's onChange (web return), via completeOAuthSignIn (mobile callback),
          // or via cancelSignIn (abandoned); the pending flag stays up until then.
        }
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          externalOAuthPending = false
          suppressAdapterRefresh = previousSuppressAdapterRefresh
          actor.send({ type: 'SIGN_IN_FAILURE', error: errorMessage(error) })
        }
        throw error
      } finally {
        signInFlight -= 1
      }
    },
    async completeOAuthSignIn(callbackUrl: string) {
      const operationEpoch = ++epoch
      signInFlight += 1
      externalOAuthPending = false
      const previousSuppressAdapterRefresh = suppressAdapterRefresh
      suppressAdapterRefresh = true
      // A no-op when the machine already sits in `signingIn` (the machine ignores
      // it there), but a completion can also arrive after cancelSignIn returned the
      // machine to `signedOut` — this re-enters the attempt from that state too.
      actor.send({ type: 'SIGN_IN_START' })
      try {
        const session = await adapter.completeOAuthSignIn(callbackUrl)
        if (!disposed && operationEpoch === epoch) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          actor.send({
            type: 'SIGN_IN_SUCCESS',
            userId: session.userId,
            expiresAt: session.expiresAt,
          })
        }
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          suppressAdapterRefresh = previousSuppressAdapterRefresh
          actor.send({ type: 'SIGN_IN_FAILURE', error: errorMessage(error) })
        }
        throw error
      } finally {
        signInFlight -= 1
      }
    },
    cancelSignIn() {
      if (disposed) return
      // Only an OAuth attempt that left the app can be abandoned; an in-call
      // sign-in (password) still owns its `signingIn` and must be left to resolve.
      if (!externalOAuthPending) return
      if (actor.getSnapshot().context.status !== 'signingIn') return
      // Invalidate the in-flight sign-in operation so a late resolution can no
      // longer drive the machine, then settle back to signedOut (an existing
      // transition — no new machine states/events for OAuth).
      epoch += 1
      externalOAuthPending = false
      locallySignedOut = true
      suppressAdapterRefresh = true
      actor.send({ type: 'SIGN_OUT' })
    },
    async signOut() {
      const previousEpoch = epoch
      const previousLocallySignedOut = locallySignedOut
      const previousSuppressAdapterRefresh = suppressAdapterRefresh
      const previousSnapshot = { ...actor.getSnapshot().context }
      const operationEpoch = ++epoch
      locallySignedOut = true
      suppressAdapterRefresh = true
      if (!disposed) actor.send({ type: 'SIGN_OUT' })
      try {
        await adapter.signOut()
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          epoch = previousEpoch
          locallySignedOut = previousLocallySignedOut
          suppressAdapterRefresh = previousSuppressAdapterRefresh
          actor.send({ type: 'RESTORE', snapshot: previousSnapshot })
        }
        throw error
      }
    },
    async refresh() {
      const operationEpoch = ++epoch
      actor.send({ type: 'REFRESH_START' })
      try {
        const session = await adapter.refresh()
        if (!disposed && operationEpoch === epoch) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          actor.send({
            type: 'REFRESH_SUCCESS',
            userId: session.userId,
            expiresAt: session.expiresAt,
          })
        }
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          actor.send({ type: 'REFRESH_FAILURE', error: errorMessage(error) })
        }
        throw error
      }
    },
    getAccessToken() {
      if (disposed || locallySignedOut) return Promise.resolve(null)
      const snapshot = actor.getSnapshot().context
      if (
        (snapshot.status !== 'authenticated' && snapshot.status !== 'refreshing') ||
        snapshot.userId === null
      ) {
        return Promise.resolve(null)
      }
      return adapter.getAccessToken().catch(() => null)
    },
    subscribe(listener) {
      if (disposed) return () => {}
      const subscription = actor.subscribe((snapshot: SnapshotFrom<typeof sessionMachine>) => {
        listener(snapshot.context)
      })
      return () => subscription.unsubscribe()
    },
    dispose() {
      if (disposed) return
      disposed = true
      epoch += 1
      adapterUnsubscribe()
      actor.stop()
    },
  }
}

interface BootstrapCallbacks {
  shouldApply(): boolean
  didFinish(): void
}

async function bootstrap(
  adapter: AuthAdapter,
  actor: Actor<typeof sessionMachine>,
  callbacks: BootstrapCallbacks,
): Promise<void> {
  try {
    const session = await adapter.bootstrap()
    if (callbacks.shouldApply()) {
      actor.send({
        type: 'BOOTSTRAP_DONE',
        userId: session?.userId ?? null,
        expiresAt: session?.expiresAt ?? null,
      })
    }
  } catch (error) {
    if (callbacks.shouldApply()) {
      actor.send({ type: 'BOOTSTRAP_FAILURE', error: errorMessage(error) })
    }
  } finally {
    callbacks.didFinish()
  }
}

function errorMessage(error: unknown): string {
  return readErrorMessage(error, 'unknown auth error')
}
