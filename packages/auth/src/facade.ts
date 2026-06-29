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
  actor.start()

  const adapterUnsubscribe = adapter.onChange((snapshot, change) => {
    if (disposed || !bootstrapped) return
    switch (snapshot.status) {
      case 'signedOut':
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
          actor.send({ type: 'AUTHENTICATED', userId: snapshot.userId, expiresAt: snapshot.expiresAt })
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
      const previousSuppressAdapterRefresh = suppressAdapterRefresh
      suppressAdapterRefresh = true
      actor.send({ type: 'SIGN_IN_START' })
      try {
        const session = await adapter.signIn(credentials)
        if (!disposed && operationEpoch === epoch) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          actor.send({ type: 'SIGN_IN_SUCCESS', userId: session.userId, expiresAt: session.expiresAt })
        }
      } catch (error) {
        if (!disposed && operationEpoch === epoch) {
          suppressAdapterRefresh = previousSuppressAdapterRefresh
          actor.send({ type: 'SIGN_IN_FAILURE', error: errorMessage(error) })
        }
        throw error
      }
    },
    async signOut() {
      epoch += 1
      locallySignedOut = true
      suppressAdapterRefresh = true
      if (!disposed) actor.send({ type: 'SIGN_OUT' })
      await adapter.signOut()
    },
    async refresh() {
      const operationEpoch = ++epoch
      actor.send({ type: 'REFRESH_START' })
      try {
        const session = await adapter.refresh()
        if (!disposed && operationEpoch === epoch) {
          locallySignedOut = false
          suppressAdapterRefresh = false
          actor.send({ type: 'REFRESH_SUCCESS', userId: session.userId, expiresAt: session.expiresAt })
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
      if ((snapshot.status !== 'authenticated' && snapshot.status !== 'refreshing') || snapshot.userId === null) {
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

async function bootstrap(adapter: AuthAdapter, actor: Actor<typeof sessionMachine>, callbacks: BootstrapCallbacks): Promise<void> {
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
