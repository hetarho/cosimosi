// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchStarsResponse, SplitDiaryResponse } from '@cosimosi/api-client'
import { invalidateUserScope } from '@cosimosi/auth/scope'

import { useDiaryDraftStore } from '../diary-draft-store.ts'
import { useProposalStore } from '../proposal-store.ts'
import { createFlowHarness, deferred } from './flow-test-harness.tsx'
import { useWritingFlowController, type WritingFlowRequests } from './use-writing-flow.ts'

const split = {
  memories: [{ name: 'harbor', mood: 'CALM', sourceText: 'the harbor', neurons: [] }],
} as unknown as SplitDiaryResponse

function renderWritingFlow(requests: Partial<WritingFlowRequests>) {
  const onError = vi.fn()
  const injected: WritingFlowRequests = {
    split: vi.fn(() => Promise.resolve(split)),
    revise: vi.fn(() => Promise.resolve(split)),
    launch: vi.fn(() =>
      Promise.resolve({
        pastDated: true,
        memoryIds: [],
        diaryId: 'diary-1',
      } as unknown as LaunchStarsResponse),
    ),
    ...requests,
  }
  const { wrapper } = createFlowHarness()
  const rendered = renderHook(() => useWritingFlowController({ onError, requests: injected }), {
    wrapper,
  })
  return { onError, requests: injected, ...rendered }
}

function openAndWrite(result: { current: ReturnType<typeof useWritingFlowController> }) {
  act(() => result.current.open())
  act(() => useDiaryDraftStore.getState().setBody('I walked to the harbor.'))
}

describe('useWritingFlowController', () => {
  // Unmount every rendered hook so a store subscription never outlives its test.
  afterEach(cleanup)

  beforeEach(() => {
    useProposalStore.getState().reset()
  })

  it('reviews the split the server proposed', async () => {
    const { result } = renderWritingFlow({})
    openAndWrite(result)

    act(() => result.current.runSplit())

    await waitFor(() => expect(result.current.status).toBe('reviewing'))
    expect(useProposalStore.getState().memories).toHaveLength(1)
  })

  it('returns to writing with the error after a failed split', async () => {
    const { result, onError } = renderWritingFlow({
      split: vi.fn(() => Promise.reject(new ConnectError('down', Code.Unavailable))),
    })
    openAndWrite(result)

    act(() => result.current.runSplit())

    await waitFor(() => expect(result.current.status).toBe('writing'))
    expect(result.current.errorKind).toBe('split')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('drops a split that lands after the user scope was invalidated', async () => {
    const pending = deferred<SplitDiaryResponse>()
    const { result } = renderWritingFlow({ split: vi.fn(() => pending.promise) })
    openAndWrite(result)

    act(() => result.current.runSplit())
    invalidateUserScope()
    await act(async () => {
      pending.resolve(split)
      await pending.promise
    })

    expect(result.current.status).toBe('splitting')
    expect(useProposalStore.getState().memories).toHaveLength(0)
  })

  it('drops a split that lands after the flow was closed and reopened', async () => {
    const pending = deferred<SplitDiaryResponse>()
    const { result } = renderWritingFlow({ split: vi.fn(() => pending.promise) })
    openAndWrite(result)

    act(() => result.current.runSplit())
    act(() => result.current.close())
    openAndWrite(result)
    await act(async () => {
      pending.resolve(split)
      await pending.promise
    })

    expect(result.current.status).toBe('writing')
    expect(useProposalStore.getState().memories).toHaveLength(0)
  })

  it('applies nothing when the flow unmounts mid-request', async () => {
    const pending = deferred<SplitDiaryResponse>()
    const { result, onError, unmount } = renderWritingFlow({ split: vi.fn(() => pending.promise) })
    openAndWrite(result)

    act(() => result.current.runSplit())
    unmount()
    pending.reject(new ConnectError('down', Code.Unavailable))
    await pending.promise.catch(() => undefined)

    expect(onError).not.toHaveBeenCalled()
  })
})
