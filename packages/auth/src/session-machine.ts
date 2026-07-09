import { assign, setup } from 'xstate'

import { initialSessionSnapshot, type SessionSnapshot } from './session.ts'

/**
 * Session machine events. Inputs are id/status-only — token refresh happens inside
 * the auth adapter; the machine only records that a refresh started or finished.
 * ARCHITECTURE §3.2: machine context stays serializable control state.
 */
export type SessionEvent =
  | { type: 'AUTHENTICATED'; userId: string; expiresAt: number }
  | { type: 'BOOTSTRAP_DONE'; userId: string | null; expiresAt: number | null }
  | { type: 'BOOTSTRAP_FAILURE'; error: string }
  | { type: 'SIGN_IN_START' }
  | { type: 'SIGN_IN_SUCCESS'; userId: string; expiresAt: number }
  | { type: 'SIGN_IN_FAILURE'; error: string }
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; userId: string; expiresAt: number }
  | { type: 'REFRESH_FAILURE'; error: string }
  | { type: 'EXPIRED' }
  | { type: 'SIGN_OUT' }
  | { type: 'RESTORE'; snapshot: SessionSnapshot }
  | { type: 'RESET' }

export const sessionMachine = setup({
  types: {
    context: {} as SessionSnapshot,
    events: {} as SessionEvent,
  },
  actions: {
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
  },
  guards: {
    hasUser: ({ event }) => event.type === 'BOOTSTRAP_DONE' && event.userId !== null,
    hasCurrentUser: ({ context }) => context.userId !== null,
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
  },
}).createMachine({
  id: 'session',
  context: initialSessionSnapshot,
  initial: 'bootstrapping',
  on: {
    RESTORE: [
      { target: '.bootstrapping', guard: 'restoringBootstrapping', actions: 'restoreSnapshot' },
      { target: '.signedOut', guard: 'restoringSignedOut', actions: 'restoreSnapshot' },
      { target: '.signingIn', guard: 'restoringSigningIn', actions: 'restoreSnapshot' },
      { target: '.authenticated', guard: 'restoringAuthenticated', actions: 'restoreSnapshot' },
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
})
