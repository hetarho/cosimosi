import { Code, ConnectError } from '@connectrpc/connect'
import { ErrorInfoSchema } from '@cosimosi/api-client'
import { setActiveLocale } from '@cosimosi/i18n'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  ERROR_REASONS,
  classifyErrorRecovery,
  isReason,
  isRetriableCode,
  presentAppError,
  toAppError,
} from './index.ts'

describe('toAppError', () => {
  beforeEach(() => setActiveLocale('en'))

  it('decodes a domain ErrorInfo without exposing debug detail as copy', () => {
    const error = connectError(Code.ResourceExhausted, {
      reason: ERROR_REASONS.twinkleInsufficient,
      domain: 'twinkle',
      requestId: 'request-domain',
      metadata: { operation: 'recall' },
      debugDetail: 'not user-facing',
    })

    expect(toAppError(error)).toEqual({
      connectCode: Code.ResourceExhausted,
      reason: ERROR_REASONS.twinkleInsufficient,
      domain: 'twinkle',
      requestId: 'request-domain',
      metadata: { operation: 'recall' },
      debugDetail: 'not user-facing',
      retriable: true,
    })
    expect(presentAppError(error)).toEqual({
      severity: 'warning',
      message: "You don't have enough stardust for that.",
      showId: false,
    })
  })

  it('shows only generic internal copy with the correlation id', () => {
    const error = connectError(Code.Internal, {
      reason: ERROR_REASONS.internal,
      domain: 'platform',
      requestId: 'request-internal',
      debugDetail: 'database exploded',
    })

    const presentation = presentAppError(error)
    expect(presentation.showId).toBe(true)
    expect(presentation.message).toContain('request-internal')
    expect(presentation.message).not.toContain('database exploded')
  })

  it('falls back deterministically for an older no-detail server', () => {
    expect(toAppError(new ConnectError('not found', Code.NotFound))).toMatchObject({
      reason: 'PLATFORM_NOT_FOUND',
      domain: 'platform',
      requestId: '',
      metadata: {},
      retriable: false,
    })
  })

  it('does not reuse a non-Connect error message as user copy', () => {
    const appError = toAppError(new Error('secret raw failure'))
    expect(appError).toMatchObject({
      connectCode: Code.Unknown,
      reason: ERROR_REASONS.unknown,
      domain: '',
      requestId: '',
    })
    expect(presentAppError(appError).message).not.toContain('secret raw failure')
  })

  it('matches reasons from unknown inputs', () => {
    const error = connectError(Code.FailedPrecondition, {
      reason: ERROR_REASONS.memorySyncConsentRequired,
      domain: 'memory',
    })
    expect(isReason(error, ERROR_REASONS.memorySyncConsentRequired)).toBe(true)
    expect(isReason(new Error('no'), ERROR_REASONS.memorySyncConsentRequired)).toBe(false)
  })

  it('derives only reason-specific consent and charge recovery', () => {
    const consent = connectError(Code.FailedPrecondition, {
      reason: ERROR_REASONS.memorySyncConsentRequired,
      domain: 'memory',
    })
    const otherPrecondition = connectError(Code.FailedPrecondition, {
      reason: ERROR_REASONS.memoryOperationConflict,
      domain: 'memory',
    })
    const insufficient = connectError(Code.ResourceExhausted, {
      reason: ERROR_REASONS.twinkleInsufficient,
      domain: 'twinkle',
    })
    const otherExhausted = connectError(Code.ResourceExhausted, {
      reason: 'PLATFORM_RESOURCE_EXHAUSTED',
      domain: 'platform',
    })

    expect(classifyErrorRecovery(consent)).toBe('sync-consent')
    expect(classifyErrorRecovery(consent, true)).toBe('none')
    expect(classifyErrorRecovery(otherPrecondition)).toBe('none')
    expect(classifyErrorRecovery(insufficient)).toBe('charge')
    expect(classifyErrorRecovery(otherExhausted)).toBe('none')
  })
})

describe('retry display classification', () => {
  it('classifies every Connect code', () => {
    const retriable = [
      Code.Unknown,
      Code.DeadlineExceeded,
      Code.ResourceExhausted,
      Code.Aborted,
      Code.Internal,
      Code.Unavailable,
    ]
    for (const code of Object.values(Code).filter(
      (value): value is Code => typeof value === 'number',
    )) {
      expect(isRetriableCode(code)).toBe(retriable.includes(code))
    }
  })
})

function connectError(
  code: Code,
  detail: {
    reason?: string
    domain?: string
    requestId?: string
    metadata?: Record<string, string>
    debugDetail?: string
  },
): ConnectError {
  return new ConnectError('safe message', code, undefined, [
    {
      desc: ErrorInfoSchema,
      value: detail,
    },
  ])
}
