// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { EpisodicMemory } from '@cosimosi/memory'
import type { RecallResponse } from '@cosimosi/api-client'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useUniverseClockStore } from '../universe-clock-store.ts'
import { useRecallTargetStore } from '../recall-target-store.ts'
import { useRecallDraftStore } from '../recall-draft-store.ts'
import { createFlowHarness } from './flow-test-harness.tsx'
import { useRecallFlowController } from './use-recall-flow.ts'

const memory: EpisodicMemory = {
  id: 'memory-1',
  diaryId: 'diary-1',
  name: 'Meeting a friend',
  seed: 1n,
  activations: [],
  semanticStage: 0,
  currentText: 'I met Ada at Seoul today.',
  emotion: { mood: 'NEUTRAL', valence: 0, arousal: 0, intensity: 0.5 },
  baseStrength: 0,
  recallCount: 0,
  createdUniverseTime: '2026-01-01',
  lastRecalledUniverseTime: null,
  forgettingOffsetDays: 0,
  decayStages: ['I xxxx at xxxx today.'],
}
beforeEach(() => {
  useRecallTargetStore.getState().clear()
  useRecallDraftStore.getState().reset()
  useEpisodicMemoryStore.getState().setAll([memory])
  useUniverseClockStore.getState().setCurrent('2026-02-15')
})
afterEach(() => {
  cleanup()
  useEpisodicMemoryStore.getState().clear()
  useUniverseClockStore.getState().clear()
})
it('submits only the inserted words, preserves its passage through a refetch and freezes an ambiguous retry', async () => {
  const request = vi.fn<
    (input: import('../recall-star.ts').RecallInput) => Promise<RecallResponse>
  >((): Promise<RecallResponse> =>
    Promise.reject(new ConnectError('response lost', Code.Unavailable)),
  )
  const { wrapper } = createFlowHarness()
  const { result } = renderHook(
    () =>
      useRecallFlowController({
        request,
        onError: vi.fn(),
        invalidateBalance: vi.fn(),
        invalidateAchievements: vi.fn(),
        requestEarnGuide: vi.fn(),
      }),
    { wrapper },
  )
  act(() => useRecallTargetStore.getState().request('memory-1'))
  await waitFor(() => expect(result.current.parts).not.toBeNull())
  expect(result.current.phase).toBe('rewriting')
  expect(result.current.parts?.map((part) => part.text).join('')).not.toContain('Ada')
  await act(() => result.current.confirmRecall())
  expect(request).not.toHaveBeenCalled()
  act(() => {
    result.current.setAnswer(1, 'met a friend')
    result.current.setAnswer(3, 'home')
  })
  act(() =>
    useEpisodicMemoryStore
      .getState()
      .setAll([{ ...memory, decayStages: ['changed xxxx passage.'] }]),
  )
  expect(result.current.rewrite).toBe('I met a friend at home today.')
  await act(() => result.current.confirmRecall())
  expect(result.current.inputLocked).toBe(true)
  act(() => result.current.setAnswer(1, 'a different request'))
  await act(() => result.current.confirmRecall())
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1]?.[0]).toEqual(request.mock.calls[0]?.[0])
  expect(request.mock.calls[0]?.[0]).toMatchObject({ rewriteText: 'I met a friend at home today.' })
  act(() => result.current.close())
  expect(useRecallDraftStore.getState()).toMatchObject({ parts: null, answers: {}, rewrite: '' })
})
