// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LetGoResponse, ReleaseResponse, SuggestLetGoResponse } from '@cosimosi/api-client'
import { invalidateUserScope } from '@cosimosi/auth/scope'

import { useDeletionTargetStore } from '../deletion-target-store.ts'
import { useDeletionDraftStore } from '../deletion-draft-store.ts'
import { createFlowHarness, deferred } from './flow-test-harness.tsx'
import { useDeletionFlowController, type DeletionFlowRequests } from './use-deletion-flow.ts'

const released = {} as ReleaseResponse
const suggested = {
  candidates: [{ neuronId: 'neuron-1', name: 'harbor', reason: 'named in the words' }],
} as unknown as SuggestLetGoResponse

function renderDeletionFlow(requests: Partial<DeletionFlowRequests>) {
  const onError = vi.fn()
  const invalidateAchievements = vi.fn()
  const injected: DeletionFlowRequests = {
    release: vi.fn(() => Promise.resolve(released)),
    suggest: vi.fn(() => Promise.resolve(suggested)),
    letGo: vi.fn(() => Promise.resolve({} as LetGoResponse)),
    ...requests,
  }
  const { wrapper } = createFlowHarness()
  const rendered = renderHook(
    () => useDeletionFlowController({ onError, invalidateAchievements, requests: injected }),
    { wrapper },
  )
  return { onError, invalidateAchievements, requests: injected, ...rendered }
}

describe('useDeletionFlowController', () => {
  beforeEach(() => {
    useDeletionTargetStore.getState().clear()
    useDeletionDraftStore.getState().reset()
  })

  it('releases the diary, refreshes achievements and closes', async () => {
    const { result, requests, invalidateAchievements } = renderDeletionFlow({})
    act(() => useDeletionTargetStore.getState().openFullDelete('diary-1'))
    await waitFor(() => expect(result.current.phase).toBe('confirmingDelete'))

    await act(() => result.current.confirmDelete())

    expect(requests.release).toHaveBeenCalledWith('diary-1')
    expect(invalidateAchievements).toHaveBeenCalledOnce()
    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(useDeletionTargetStore.getState().target).toBeNull()
  })

  it('returns to the confirm with the error after a failed release', async () => {
    const { result, onError } = renderDeletionFlow({
      release: vi.fn(() => Promise.reject(new ConnectError('down', Code.Unavailable))),
    })
    act(() => useDeletionTargetStore.getState().openFullDelete('diary-1'))
    await waitFor(() => expect(result.current.phase).toBe('confirmingDelete'))

    await act(() => result.current.confirmDelete())

    expect(result.current.phase).toBe('confirmingDelete')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('drops a suggestion that lands after the user scope was invalidated', async () => {
    const pending = deferred<SuggestLetGoResponse>()
    const { result } = renderDeletionFlow({ suggest: vi.fn(() => pending.promise) })
    act(() => useDeletionTargetStore.getState().openLetGo('memory-1'))
    await waitFor(() => expect(result.current.phase).toBe('phrasing'))

    let run!: Promise<void>
    act(() => {
      run = result.current.runSuggest()
    })
    invalidateUserScope()
    await act(async () => {
      pending.resolve(suggested)
      await run
    })

    expect(result.current.phase).toBe('suggesting')
    expect(useDeletionDraftStore.getState().candidates).toHaveLength(0)
  })

  it('applies nothing when the flow unmounts mid-request', async () => {
    const pending = deferred<ReleaseResponse>()
    const { result, onError, invalidateAchievements, unmount } = renderDeletionFlow({
      release: vi.fn(() => pending.promise),
    })
    act(() => useDeletionTargetStore.getState().openFullDelete('diary-1'))
    await waitFor(() => expect(result.current.phase).toBe('confirmingDelete'))

    let run!: Promise<void>
    act(() => {
      run = result.current.confirmDelete()
    })
    unmount()
    pending.reject(new ConnectError('down', Code.Unavailable))
    await run

    expect(onError).not.toHaveBeenCalled()
    expect(invalidateAchievements).not.toHaveBeenCalled()
  })
})
