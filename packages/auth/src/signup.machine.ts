import { assign, setup } from 'xstate'

export interface SignupCredentialContext {
  error: string | null
}

export type SignupCredentialEvent =
  | { type: 'SUBMIT' }
  | { type: 'SIGNED_IN' }
  | { type: 'CONFIRMATION_REQUIRED' }
  | { type: 'FAILURE'; error: string }
  | { type: 'RESET' }

export const signupCredentialMachine = setup({
  types: {
    context: {} as SignupCredentialContext,
    events: {} as SignupCredentialEvent,
  },
  actions: {
    clearError: assign({ error: null }),
    setError: assign(({ event }) => (event.type === 'FAILURE' ? { error: event.error } : {})),
  },
}).createMachine({
  id: 'signupCredential',
  initial: 'form',
  context: { error: null },
  states: {
    form: {
      on: { SUBMIT: { target: 'creating', actions: 'clearError' } },
    },
    creating: {
      on: {
        SIGNED_IN: { target: 'form', actions: 'clearError' },
        CONFIRMATION_REQUIRED: { target: 'confirmationSent', actions: 'clearError' },
        FAILURE: { target: 'failed', actions: 'setError' },
      },
    },
    confirmationSent: {
      on: { RESET: { target: 'form', actions: 'clearError' } },
    },
    failed: {
      on: {
        SUBMIT: { target: 'creating', actions: 'clearError' },
        RESET: { target: 'form', actions: 'clearError' },
      },
    },
  },
})
