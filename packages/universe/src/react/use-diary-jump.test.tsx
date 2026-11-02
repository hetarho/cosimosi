// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorInfoSchema, type RecallDiaryStarsResponse } from '@cosimosi/api-client'
import { invalidateUserScope } from '@cosimosi/auth/scope'
import { ERROR_REASONS } from '@cosimosi/errors/core'

import { createFlowHarness, deferred } from './flow-test-harness.tsx'
import { useDiaryJump, type DiaryRecallInput } from './use-diary-jump.ts'

const refusal = (code: Code, reason: string) =>
  new ConnectError('refused', code, undefined, [
    { desc: ErrorInfoSchema, value: { reason, domain: 'memory' } },
  ])

const recalled = { episodicMemoryIds: ['memory-1'] } as unknown as RecallDiaryStarsResponse

function renderDiaryJump(request: (input: DiaryRecallInput) => Promise<RecallDiaryStarsResponse>) {
  const ports = {
    onExit: vi.fn(),
    onError: vi.fn(),
    invalidateBalance: vi.fn(),
    invalidateAchievements: vi.fn(),
    requestEarnGuide: vi.fn(),
    request: vi.fn(request),
  }
  const { wrapper } = createFlowHarness()
  const rendered = renderHook(() => useDiaryJump(ports), { wrapper })
  return { ports, ...rendered }
}

const operationIds = (ports: { request: { mock: { calls: [DiaryRecallInput][] } } }) =>
  ports.request.mock.calls.map(([input]) => input.operationId)

describe('useDiaryJump', () => {
  // Unmount every rendered hook so a store subscription never outlives its test.
  afterEach(cleanup)

  it('keeps the operation id after an ambiguous failure, retrying once with it', async () => {
    const { ports, result } = renderDiaryJump(() =>
      Promise.reject(new ConnectError('down', Code.Unavailable)),
    )
    act(() => result.current.initiateJump('diary-1'))

    await act(() => result.current.proceedQuote())
    expect(result.current.phase).toBe('browsing')
    await act(() => result.current.proceedQuote())

    const ids = operationIds(ports)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(1)
    expect(ports.onError).toHaveBeenCalledTimes(2)
  })

  it('mints a new attempt after a known refusal and asks for earnings when the balance is short', async () => {
    const { ports, result } = renderDiaryJump(() =>
      Promise.reject(refusal(Code.ResourceExhausted, ERROR_REASONS.memoryInsufficientTwinkle)),
    )
    act(() => result.current.initiateJump('diary-1'))

    await act(() => result.current.proceedQuote())
    await act(() => result.current.proceedQuote())

    const [first, second] = operationIds(ports)
    expect(second).not.toBe(first)
    expect(ports.requestEarnGuide).toHaveBeenCalledTimes(2)
  })

  it('returns to the consent step when the server requires a sync the user had not accepted', async () => {
    const { result } = renderDiaryJump(() =>
      Promise.reject(refusal(Code.FailedPrecondition, ERROR_REASONS.memorySyncConsentRequired)),
    )
    act(() => result.current.initiateJump('diary-1'))

    await act(() => result.current.proceedQuote())

    expect(result.current.phase).toBe('confirming')
  })

  it('drops a completion that lands after the user scope was invalidated', async () => {
    const pending = deferred<RecallDiaryStarsResponse>()
    const { ports, result } = renderDiaryJump(() => pending.promise)
    act(() => result.current.initiateJump('diary-1'))

    let run!: Promise<void>
    act(() => {
      run = result.current.proceedQuote()
    })
    await waitFor(() => expect(ports.request).toHaveBeenCalled())
    invalidateUserScope()
    await act(async () => {
      pending.resolve(recalled)
      await run
    })

    expect(result.current.phase).toBe('recalling')
    expect(ports.onExit).not.toHaveBeenCalled()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })

  it('applies nothing when the reader unmounts mid-request', async () => {
    const pending = deferred<RecallDiaryStarsResponse>()
    const { ports, result, unmount } = renderDiaryJump(() => pending.promise)
    act(() => result.current.initiateJump('diary-1'))

    let run!: Promise<void>
    act(() => {
      run = result.current.proceedQuote()
    })
    await waitFor(() => expect(ports.request).toHaveBeenCalled())
    unmount()
    pending.reject(refusal(Code.ResourceExhausted, ERROR_REASONS.memoryInsufficientTwinkle))
    await run

    expect(ports.onError).not.toHaveBeenCalled()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })
})
