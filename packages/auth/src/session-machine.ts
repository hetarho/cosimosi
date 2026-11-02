import { and, assertEvent, assign, not, or, raise, setup, stateIn, type SnapshotFrom } from 'xstate'

import { initialSessionSnapshot, type SessionSnapshot } from './session.ts'

/** Whether a local sign-out holds the session closed, and whether it was forced. */
export type SessionAccess = 'open' | 'closed' | 'forced'
/**
 * The sign-in the machine still awaits: a call the app is making (`inCall`), a Google call that may
 * leave the app (`external`), or a Google flow that continues outside it (`outsideApp`).
 */
export type SignInAttempt = 'idle' | 'inCall' | 'external' | 'outsideApp'

/**
 * Session machine events. Inputs are id/status-only — token refresh happens inside the auth adapter;
 * the machine only records that a refresh started or finished. `ADAPTER_*` events carry what the
 * adapter reported; the machine decides whether each one applies. ARCH-24: context stays
 * serializable control state, and everything else the lifecycle needs is a state.
 */
export type SessionEvent =
  | { type: 'BOOTSTRAP_DONE'; userId: string | null; expiresAt: number | null }
  | { type: 'BOOTSTRAP_FAILURE'; error: string }
  | { type: 'BOOTSTRAP_SETTLED' }
  | { type: 'SIGN_IN_START'; external?: boolean }
  | { type: 'SIGN_IN_LEFT_APP' }
  | { type: 'SIGN_IN_SUCCESS'; userId: string; expiresAt: number }
  | { type: 'SIGN_IN_FAILURE'; error: string }
  | { type: 'CANCEL_SIGN_IN' }
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; userId: string; expiresAt: number }
  | { type: 'REFRESH_FAILURE'; error: string }
  | { type: 'ADAPTER_AUTHENTICATED'; userId: string; expiresAt: number; refreshed: boolean }
  | { type: 'ADAPTER_SIGNED_OUT' }
  | { type: 'ADAPTER_EXPIRED' }
  | { type: 'AUTHENTICATED'; userId: string; expiresAt: number }
  | { type: 'EXPIRED' }
  | { type: 'SIGN_OUT'; forced?: boolean }
  | {
      type: 'RESTORE'
      snapshot: SessionSnapshot
      access: SessionAccess
      attempt: SignInAttempt
    }
  | { type: 'RESET' }
  | { type: 'DISPOSE' }

export const sessionMachine = setup({
  types: {
    context: {} as SessionSnapshot,
    events: {} as SessionEvent,
  },
  actions: {
    // Invalidates the facade's in-flight operations when the machine itself ends a session; the
    // facade provides it over its operation epoch.
    fence: () => {},
    signOut: raise({ type: 'SIGN_OUT' }),
    expire: raise({ type: 'EXPIRED' }),
    setBootstrapped: assign(({ event }) => {
      if (event.type !== 'BOOTSTRAP_DONE') return {}
      return event.userId
        ? { status: 'authenticated', userId: event.userId, expiresAt: event.expiresAt, error: null }
        : { status: 'signedOut', userId: null, expiresAt: null, error: null }
    }),
    setSigningIn: assign({ status: 'signingIn', userId: null, expiresAt: null, error: null }),
    setAuthenticated: assign(({ event }) =>
      event.type === 'SIGN_IN_SUCCESS' || event.type === 'AUTHENTICATED'
        ? { status: 'authenticated', userId: event.userId, expiresAt: event.expiresAt, error: null }
        : {},
    ),
    setFailed: assign(({ event }) =>
      event.type === 'SIGN_IN_FAILURE' || event.type === 'BOOTSTRAP_FAILURE'
        ? { status: 'failed', userId: null, expiresAt: null, error: event.error }
        : {},
    ),
    setRefreshing: assign(({ context }) => ({
      status: 'refreshing',
      userId: context.userId,
      expiresAt: context.expiresAt,
      error: null,
    })),
    setRefreshed: assign(({ event }) =>
      event.type === 'REFRESH_SUCCESS'
        ? { status: 'authenticated', userId: event.userId, expiresAt: event.expiresAt, error: null }
        : {},
    ),
    setExpired: assign({ status: 'expired', userId: null, expiresAt: null, error: null }),
    setRefreshFailed: assign(({ event }) =>
      event.type === 'REFRESH_FAILURE'
        ? { status: 'failed', userId: null, expiresAt: null, error: event.error }
        : {},
    ),
    setRefreshError: assign(({ context, event }) =>
      event.type === 'REFRESH_FAILURE'
        ? {
            status: 'authenticated',
            userId: context.userId,
            expiresAt: context.expiresAt,
            error: event.error,
          }
        : {},
    ),
    setSignedOut: assign({ status: 'signedOut', userId: null, expiresAt: null, error: null }),
    restoreSnapshot: assign(({ event }) => (event.type === 'RESTORE' ? event.snapshot : {})),
    authenticateFromAdapter: raise(({ event }) => {
      assertEvent(event, 'ADAPTER_AUTHENTICATED')
      return { type: 'AUTHENTICATED' as const, userId: event.userId, expiresAt: event.expiresAt }
    }),
  },
  guards: {
    hasUser: ({ event }) => event.type === 'BOOTSTRAP_DONE' && event.userId !== null,
    hasCurrentUser: ({ context }) => context.userId !== null,
    failed: ({ context }) => context.status === 'failed',
    booting: stateIn({ running: { boot: 'pending' } }),
    forcedOut: stateIn({ running: { access: 'forced' } }),
    forcedSignOut: ({ event }) => event.type === 'SIGN_OUT' && event.forced === true,
    externalStart: ({ event }) => event.type === 'SIGN_IN_START' && event.external === true,
    refreshedByAdapter: ({ event }) => event.type === 'ADAPTER_AUTHENTICATED' && event.refreshed,
    awaitingSignInCall: or([
      stateIn({ running: { attempt: 'inCall' } }),
      stateIn({ running: { attempt: 'external' } }),
    ]),
    // A token refresh the adapter performs on its own must not revive a session the app closed or
    // is replacing.
    suppressingAdapterRefresh: or([
      not(stateIn({ running: { access: 'open' } })),
      not(stateIn({ running: { attempt: 'idle' } })),
    ]),
    googleFlowOpen: and([
      stateIn({ running: { session: 'signingIn' } }),
      or([
        stateIn({ running: { attempt: 'external' } }),
        stateIn({ running: { attempt: 'outsideApp' } }),
      ]),
    ]),
    restoringBootstrapping: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'bootstrapping',
    restoringSignedOut: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'signedOut',
    restoringSigningIn: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'signingIn',
    restoringAuthenticated: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'authenticated',
    restoringRefreshing: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'refreshing',
    restoringExpired: ({ event }) =>
      event.type === 'RESTORE' && event.snapshot.status === 'expired',
    restoringFailed: ({ event }) => event.type === 'RESTORE' && event.snapshot.status === 'failed',
    restoringOpen: ({ event }) => event.type === 'RESTORE' && event.access === 'open',
    restoringClosed: ({ event }) => event.type === 'RESTORE' && event.access === 'closed',
    restoringIdle: ({ event }) => event.type === 'RESTORE' && event.attempt === 'idle',
    restoringInCall: ({ event }) => event.type === 'RESTORE' && event.attempt === 'inCall',
    restoringExternal: ({ event }) => event.type === 'RESTORE' && event.attempt === 'external',
  },
}).createMachine({
  id: 'session',
  context: initialSessionSnapshot,
  initial: 'running',
  states: {
    running: {
      type: 'parallel',
      on: {
        DISPOSE: 'disposed',
        // "No session" is already true while a sign-in call is awaited or after one failed (`failed`
        // holds the error the visitor must see), so the event would only end the attempt or erase
        // the error. Any sign-in already fenced a pending bootstrap when it started.
        ADAPTER_SIGNED_OUT: {
          guard: not(or(['awaitingSignInCall', 'failed'])),
          actions: ['fence', 'signOut'],
        },
        // Before the bootstrap settles, an expired session is no session: the restore it would race
        // must not land.
        ADAPTER_EXPIRED: [
          { guard: 'booting', actions: ['fence', 'signOut'] },
          { actions: 'expire' },
        ],
        ADAPTER_AUTHENTICATED: {
          guard: and([
            not('booting'),
            not('forcedOut'),
            not(and(['refreshedByAdapter', 'suppressingAdapterRefresh'])),
          ]),
          actions: 'authenticateFromAdapter',
        },
        // Only a Google flow can be abandoned; an in-call sign-in still owns its `signingIn` and is
        // left to resolve, so a host's blanket "foreground → cancel" never kills a password attempt.
        CANCEL_SIGN_IN: { guard: 'googleFlowOpen', actions: ['fence', 'signOut'] },
      },
      states: {
        session: {
          initial: 'bootstrapping',
          on: {
            RESTORE: [
              {
                target: '.bootstrapping',
                guard: 'restoringBootstrapping',
                actions: 'restoreSnapshot',
              },
              { target: '.signedOut', guard: 'restoringSignedOut', actions: 'restoreSnapshot' },
              { target: '.signingIn', guard: 'restoringSigningIn', actions: 'restoreSnapshot' },
              {
                target: '.authenticated',
                guard: 'restoringAuthenticated',
                actions: 'restoreSnapshot',
              },
              { target: '.refreshing', guard: 'restoringRefreshing', actions: 'restoreSnapshot' },
              { target: '.expired', guard: 'restoringExpired', actions: 'restoreSnapshot' },
              { target: '.failed', guard: 'restoringFailed', actions: 'restoreSnapshot' },
            ],
          },
          states: {
            bootstrapping: {
              on: {
                BOOTSTRAP_DONE: [
                  { target: 'authenticated', guard: 'hasUser', actions: 'setBootstrapped' },
                  { target: 'signedOut', actions: 'setBootstrapped' },
                ],
                BOOTSTRAP_FAILURE: { target: 'failed', actions: 'setFailed' },
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                SIGN_IN_START: { target: 'signingIn', actions: 'setSigningIn' },
                SIGN_IN_SUCCESS: { target: 'authenticated', actions: 'setAuthenticated' },
                SIGN_IN_FAILURE: { target: 'failed', actions: 'setFailed' },
                REFRESH_START: { target: 'refreshing', actions: 'setRefreshing' },
                REFRESH_SUCCESS: { target: 'authenticated', actions: 'setRefreshed' },
                REFRESH_FAILURE: { target: 'failed', actions: 'setRefreshFailed' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
            signedOut: {
              on: {
                SIGN_IN_START: { target: 'signingIn', actions: 'setSigningIn' },
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
              },
            },
            signingIn: {
              on: {
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                SIGN_IN_SUCCESS: { target: 'authenticated', actions: 'setAuthenticated' },
                SIGN_IN_FAILURE: { target: 'failed', actions: 'setFailed' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
            authenticated: {
              on: {
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                REFRESH_START: { target: 'refreshing', actions: 'setRefreshing' },
                EXPIRED: { target: 'expired', actions: 'setExpired' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
            refreshing: {
              on: {
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                REFRESH_SUCCESS: { target: 'authenticated', actions: 'setRefreshed' },
                REFRESH_FAILURE: [
                  { target: 'authenticated', guard: 'hasCurrentUser', actions: 'setRefreshError' },
                  { target: 'failed', actions: 'setRefreshFailed' },
                ],
                EXPIRED: { target: 'expired', actions: 'setExpired' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
            expired: {
              on: {
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                REFRESH_START: { target: 'refreshing', actions: 'setRefreshing' },
                SIGN_IN_START: { target: 'signingIn', actions: 'setSigningIn' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
            failed: {
              on: {
                AUTHENTICATED: { target: 'authenticated', actions: 'setAuthenticated' },
                SIGN_IN_START: { target: 'signingIn', actions: 'setSigningIn' },
                RESET: { target: 'signedOut', actions: 'setSignedOut' },
                SIGN_OUT: { target: 'signedOut', actions: 'setSignedOut' },
              },
            },
          },
        },
        // The adapter's own bootstrap read has settled, whether or not its result still applied.
        // Until then an adapter session report is ignored: the bootstrap is about to say the same.
        boot: {
          initial: 'pending',
          states: {
            pending: { on: { BOOTSTRAP_SETTLED: 'settled' } },
            settled: {},
          },
        },
        access: {
          initial: 'open',
          on: {
            RESTORE: [
              { target: '.open', guard: 'restoringOpen' },
              { target: '.closed', guard: 'restoringClosed' },
              { target: '.forced' },
            ],
          },
          states: {
            open: {
              on: {
                SIGN_OUT: [{ target: 'forced', guard: 'forcedSignOut' }, { target: 'closed' }],
              },
            },
            closed: {
              on: {
                SIGN_OUT: { target: 'forced', guard: 'forcedSignOut' },
                SIGN_IN_SUCCESS: 'open',
                REFRESH_SUCCESS: 'open',
                AUTHENTICATED: 'open',
              },
            },
            // A forced sign-out outlives the adapter: its session reports and refreshes are refused
            // until the visitor signs in again.
            forced: { on: { SIGN_IN_SUCCESS: 'open' } },
          },
        },
        attempt: {
          initial: 'idle',
          on: {
            SIGN_IN_START: [{ target: '.external', guard: 'externalStart' }, { target: '.inCall' }],
            SIGN_IN_SUCCESS: '.idle',
            SIGN_IN_FAILURE: '.idle',
            SIGN_OUT: '.idle',
            AUTHENTICATED: '.idle',
            RESTORE: [
              { target: '.idle', guard: 'restoringIdle' },
              { target: '.inCall', guard: 'restoringInCall' },
              { target: '.external', guard: 'restoringExternal' },
              { target: '.outsideApp' },
            ],
          },
          states: {
            idle: {},
            // A refresh fences the awaited call, so its result will never arrive.
            inCall: { on: { REFRESH_START: 'idle' } },
            external: { on: { REFRESH_START: 'idle', SIGN_IN_LEFT_APP: 'outsideApp' } },
            // Settles through the adapter's report (web return), a completion call (mobile callback)
            // or a cancel.
            outsideApp: {},
          },
        },
      },
    },
    disposed: { type: 'final' },
  },
})

export type SessionMachineSnapshot = SnapshotFrom<typeof sessionMachine>

const inRunning = (snapshot: SessionMachineSnapshot) => snapshot.status === 'active'

/** The transport may read a token: a live, locally open session that holds an identity. */
export function holdsAccessToken(snapshot: SessionMachineSnapshot): boolean {
  const { status, userId } = snapshot.context
  return (
    inRunning(snapshot) &&
    snapshot.matches({ running: { access: 'open' } }) &&
    (status === 'authenticated' || status === 'refreshing') &&
    userId !== null
  )
}

/** A forced sign-out refuses refresh: the adapter's session must not come back. */
export function refreshAllowed(snapshot: SessionMachineSnapshot): boolean {
  return inRunning(snapshot) && !snapshot.matches({ running: { access: 'forced' } })
}

/** What a failed sign-out puts back: the snapshot and the regions it closed. */
export function restorePoint(
  snapshot: SessionMachineSnapshot,
): Extract<SessionEvent, { type: 'RESTORE' }> {
  const access = (['open', 'closed', 'forced'] as const).find((child) =>
    snapshot.matches({ running: { access: child } }),
  )
  const attempt = (['idle', 'inCall', 'external', 'outsideApp'] as const).find((child) =>
    snapshot.matches({ running: { attempt: child } }),
  )
  return {
    type: 'RESTORE',
    snapshot: { ...snapshot.context },
    access: access ?? 'open',
    attempt: attempt ?? 'idle',
  }
}
