// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorInfoSchema, type RecallResponse } from '@cosimosi/api-client'
import { invalidateUserScope } from '@cosimosi/auth/scope'
import { ERROR_REASONS } from '@cosimosi/errors/core'

import { useRecallTargetStore } from '../recall-target-store.ts'
import { useRecallDraftStore } from '../recall-draft-store.ts'
import type { RecallInput } from '../recall-star.ts'
import { createFlowHarness, deferred } from './flow-test-harness.tsx'
import { useRecallFlowController } from './use-recall-flow.ts'

const refusal = (code: Code, reason: string) =>
  new ConnectError('refused', code, undefined, [
    { desc: ErrorInfoSchema, value: { reason, domain: 'memory' } },
  ])

const recalled = {
  reconsolidated: false,
  currentText: 'kept',
  seed: 0n,
} as unknown as RecallResponse

function renderRecallFlow(
  request: (input: RecallInput) => Promise<RecallResponse>,
  needsSync = false,
) {
  const ports = {
    onError: vi.fn(),
    invalidateBalance: vi.fn(),
    invalidateAchievements: vi.fn(),
    requestEarnGuide: vi.fn(),
    request: vi.fn(request),
  }
  const { wrapper } = createFlowHarness({ needsSync })
  const rendered = renderHook(() => useRecallFlowController(ports), { wrapper })
  return { ports, ...rendered }
}

// Opens the flow on a memory and walks it to the rewrite step, ready to confirm.
async function openToRewrite(result: { current: ReturnType<typeof useRecallFlowController> }) {
  act(() => useRecallTargetStore.getState().request('memory-1'))
  await waitFor(() => expect(result.current.phase).not.toBe('idle'))
  if (result.current.phase === 'confirmingSync') act(() => result.current.acceptSync())
  if (result.current.phase === 'quoting') act(() => result.current.acceptQuote())
  act(() => useRecallDraftStore.setState({ rewrite: 'a new telling' }))
  expect(result.current.phase).toBe('rewriting')
}

describe('useRecallFlowController', () => {
  // Unmount every rendered hook so a store subscription never outlives its test.
  afterEach(cleanup)

  beforeEach(() => {
    useRecallTargetStore.getState().clear()
    useRecallDraftStore.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('opens free reconstruction without accepting a quote', async () => {
    const { result } = renderRecallFlow(async () => recalled)
    act(() => useRecallTargetStore.getState().request('memory-1'))
    await waitFor(() => expect(result.current.phase).toBe('rewriting'))
    expect(result.current.mode).toBe('recall')
  })

  it('quotes restoration and calls its dedicated RPC without a user rewrite', async () => {
    const restore = vi.fn<(input: unknown) => RecallResponse>(() => recalled)
    const recall = vi.fn(() => recalled)
    const { wrapper } = createFlowHarness({ memory: { restoreMemoryText: restore, recall } })
    const ports = {
      onError: vi.fn(),
      invalidateBalance: vi.fn(),
      invalidateAchievements: vi.fn(),
      requestEarnGuide: vi.fn(),
    }
    const { result } = renderHook(() => useRecallFlowController(ports), { wrapper })
    act(() => useRecallTargetStore.getState().request('memory-1', 'restore'))
    await waitFor(() => expect(result.current.phase).toBe('quoting'))
    act(() => result.current.acceptQuote())
    await act(() => result.current.confirmRecall())
    expect(result.current.phase).toBe('result')
    expect(restore).toHaveBeenCalledOnce()
    expect(recall).not.toHaveBeenCalled()
    expect(restore.mock.calls[0]?.[0]).not.toHaveProperty('rewriteText')
  })

  it('keeps the operation id after an ambiguous failure, so the retry replays the receipt', async () => {
    const { ports, result } = renderRecallFlow(() =>
      Promise.reject(new ConnectError('down', Code.Unavailable)),
    )
    await openToRewrite(result)

    await act(() => result.current.confirmRecall())
    expect(result.current.phase).toBe('rewriting')
    await act(() => result.current.confirmRecall())

    const [first, second] = ports.request.mock.calls.map(([input]) => input.operationId)
    expect(first).toBeTruthy()
    expect(second).toBe(first)
    expect(ports.onError).toHaveBeenCalledTimes(2)
  })

  it('mints a new attempt after a known refusal', async () => {
    const { ports, result } = renderRecallFlow(() =>
      Promise.reject(refusal(Code.ResourceExhausted, ERROR_REASONS.memoryInsufficientTwinkle)),
    )
    await openToRewrite(result)

    await act(() => result.current.confirmRecall())
    expect(result.current.phase).toBe('rewriting')
    expect(ports.requestEarnGuide).not.toHaveBeenCalled()
    if (result.current.phase === 'quoting') act(() => result.current.acceptQuote())
    await act(() => result.current.confirmRecall())

    const [first, second] = ports.request.mock.calls.map(([input]) => input.operationId)
    expect(second).not.toBe(first)
  })

  it('returns to the consent step when the server requires a sync the user had not accepted', async () => {
    const { ports, result } = renderRecallFlow(() =>
      Promise.reject(refusal(Code.FailedPrecondition, ERROR_REASONS.memorySyncConsentRequired)),
    )
    await openToRewrite(result)

    await act(() => result.current.confirmRecall())

    expect(result.current.phase).toBe('confirmingSync')
    expect(ports.request.mock.calls[0]?.[0].syncConsent).toBe(false)
  })

  it('drops a completion that lands after the user scope was invalidated', async () => {
    const pending = deferred<RecallResponse>()
    const { ports, result } = renderRecallFlow(() => pending.promise)
    await openToRewrite(result)

    let confirm!: Promise<void>
    act(() => {
      confirm = result.current.confirmRecall()
    })
    invalidateUserScope()
    await act(async () => {
      pending.resolve(recalled)
      await confirm
    })

    expect(result.current.phase).toBe('reconsolidating')
    expect(useRecallDraftStore.getState().result).toBeNull()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })

  it('applies nothing when the flow unmounts mid-request', async () => {
    const pending = deferred<RecallResponse>()
    const { ports, result, unmount } = renderRecallFlow(() => pending.promise)
    await openToRewrite(result)

    let confirm!: Promise<void>
    act(() => {
      confirm = result.current.confirmRecall()
    })
    unmount()
    pending.reject(new ConnectError('down', Code.Unavailable))
    await confirm

    expect(ports.onError).not.toHaveBeenCalled()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })
})
