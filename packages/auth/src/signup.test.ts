import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { validateNickname } from './nickname.ts'
import { gateDecision } from './gate-decision.ts'
import {
  createMemoryPendingInviteStorage,
  createPendingInviteHolder,
  inviteLinkPath,
} from './pending-invite.ts'
import {
  recordSignupCompletion,
  resetSignupUserState,
  takeSignupCompletion,
} from './signup-completion.ts'
import { signupCredentialMachine } from './signup.machine.ts'
import { sessionMachine } from './session-machine.ts'

describe('signup shared state', () => {
  it('validates trimmed Unicode code points against generated bounds', () => {
    expect(validateNickname('  코시모시  ')).toMatchObject({
      nickname: '코시모시',
      codePointLength: 4,
      valid: true,
    })
    expect(validateNickname('🌌🌱')).toMatchObject({ codePointLength: 2, valid: true })
    expect(validateNickname(' ')).toMatchObject({ codePointLength: 0, valid: false })
    expect(validateNickname('a'.repeat(VALUES.account.nicknameMaxLength + 1)).valid).toBe(false)
  })

  it('holds, consumes, and clears one opaque invite token', () => {
    const storage = createMemoryPendingInviteStorage()
    const holder = createPendingInviteHolder(storage)
    holder.capture('opaque-token')
    expect(holder.peek()).toBe('opaque-token')
    // Rebinding after a full-page/system-browser OAuth round trip reads the same
    // storage rather than relying on a mounted wizard instance.
    expect(createPendingInviteHolder(storage).peek()).toBe('opaque-token')
    expect(holder.consume()).toBe('opaque-token')
    expect(holder.consume()).toBeNull()
    expect(inviteLinkPath('a/b')).toBe('/invite/a%2Fb')
  })

  it('records signup completion as a one-shot signal', () => {
    resetSignupUserState()
    recordSignupCompletion()
    expect(takeSignupCompletion()).toBe(true)
    expect(takeSignupCompletion()).toBe(false)
  })

  it('keeps confirmation presentation in the local credential machine', () => {
    const actor = createActor(signupCredentialMachine).start()
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('creating')
    actor.send({ type: 'CONFIRMATION_REQUIRED' })
    expect(actor.getSnapshot().value).toBe('confirmationSent')
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('form')
  })

  it('does not extend the shared session statuses or gate decisions', () => {
    expect(Object.keys(sessionMachine.config.states ?? {})).toEqual([
      'bootstrapping',
      'signedOut',
      'signingIn',
      'authenticated',
      'refreshing',
      'expired',
      'failed',
    ])
    expect(
      [
        'bootstrapping',
        'signedOut',
        'signingIn',
        'authenticated',
        'refreshing',
        'expired',
        'failed',
      ].map((status) => gateDecision(status as Parameters<typeof gateDecision>[0])),
    ).toEqual(['hold', 'login', 'login', 'universe', 'hold', 'login', 'login'])
  })
})
