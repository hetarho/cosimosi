import { Code, ConnectError } from '@connectrpc/connect'
import { describe, expect, it } from 'vitest'

import {
  classifyPaidActionError,
  createPaidActionSession,
  newOperationId,
} from './paid-action-session.ts'

describe('newOperationId', () => {
  it('mints a non-empty, unique-per-call id', () => {
    const a = newOperationId()
    const b = newOperationId()
    expect(a).not.toBe('')
    expect(b).not.toBe('')
    expect(a).not.toBe(b)
  })
})

describe('classifyPaidActionError', () => {
  it('treats pre-commit refusals as known — the next attempt spends fresh (A5)', () => {
    const knownRefusals = [
      Code.ResourceExhausted, // insufficient twinkle
      Code.FailedPrecondition, // consent required / stage not risen / target unavailable
      Code.InvalidArgument, // malformed input / missing operation id
      Code.NotFound, // target gone
      Code.AlreadyExists, // operation id reused for a different input
      Code.Unauthenticated,
    ]
    for (const code of knownRefusals) {
      expect(classifyPaidActionError(new ConnectError('refused', code))).toBe('known-refusal')
    }
  })

  it('treats commit-unknown failures as ambiguous — the same id recovers the receipt (A2)', () => {
    expect(classifyPaidActionError(new ConnectError('boom', Code.Internal))).toBe('ambiguous')
    expect(classifyPaidActionError(new ConnectError('down', Code.Unavailable))).toBe('ambiguous')
    expect(classifyPaidActionError(new ConnectError('deadline', Code.DeadlineExceeded))).toBe(
      'ambiguous',
    )
    // A non-Connect error (a raw network/timeout throw) is ambiguous too — never a known refusal.
    expect(classifyPaidActionError(new Error('network'))).toBe('ambiguous')
    expect(classifyPaidActionError(undefined)).toBe('ambiguous')
  })
})

describe('createPaidActionSession', () => {
  it('suppresses a repeated submit synchronously and releases only the matching request', () => {
    const session = createPaidActionSession(() => 'operation-1')
    const attempt = session.begin('memory-1')

    expect(session.start(attempt)).toBe(true)
    expect(session.start(attempt)).toBe(false)
    expect(session.finish(attempt)).toBe(true)
    expect(session.start(attempt)).toBe(true)
  })

  it('keeps one attempt active for an ambiguous response-loss retry', () => {
    const session = createPaidActionSession(() => 'operation-1')
    const attempt = session.begin('memory-1')

    session.start(attempt)
    session.finish(attempt)

    expect(session.isActive(attempt)).toBe(true)
    expect(session.start(attempt)).toBe(true)
    expect(attempt.operationId).toBe('operation-1')
  })

  it('fences a late completion after target replacement', () => {
    let nextId = 0
    const session = createPaidActionSession(() => `operation-${++nextId}`)
    const first = session.begin('memory-1')
    session.start(first)
    const second = session.begin('memory-2')

    expect(session.isActive(first)).toBe(false)
    expect(session.finish(first)).toBe(false)
    expect(session.isActive(second)).toBe(true)
    expect(session.start(second)).toBe(true)
  })

  it('fences late completion after unmount or sign-out invalidation', () => {
    const session = createPaidActionSession(() => 'operation-1')
    const attempt = session.begin('memory-1')
    session.start(attempt)

    session.invalidate()

    expect(session.isActive(attempt)).toBe(false)
    expect(session.finish(attempt)).toBe(false)
  })
})
