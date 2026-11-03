// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Diary } from '@cosimosi/memory'
import { useDiaryJump } from './use-diary-jump.ts'
import { useDiaryMemoryNavigationStore } from '../diary-memory-navigation-store.ts'
import { usePendingFlyTargetStore } from '../pending-fly-target-store.ts'
import { useSpotlightStore } from '../spotlight-store.ts'

const diary: Diary = {
  id: 'diary',
  body: 'original',
  diaryDate: '2026-08-01',
  createdUniverseTime: '2026-08-01',
  memories: ['one', 'two', 'three'].map((episodicMemoryId) => ({
    episodicMemoryId,
    name: episodicMemoryId,
    mood: 'JOY',
  })),
}
beforeEach(() => {
  useDiaryMemoryNavigationStore.getState().clear()
  usePendingFlyTargetStore.getState().clear()
  useSpotlightStore.getState().clear()
})
afterEach(cleanup)
it('opens all members without any transport, quote, sync or mutation provider', () => {
  const onExit = vi.fn()
  const { result } = renderHook(() => useDiaryJump({ onExit }))
  act(() => result.current.initiateJump(diary))
  expect(onExit).toHaveBeenCalledOnce()
  expect(useDiaryMemoryNavigationStore.getState().memoryIds).toEqual(['one', 'two', 'three'])
  expect(usePendingFlyTargetStore.getState()).toMatchObject({ nodeId: 'one', select: true })
  expect(useSpotlightStore.getState().memoryIds).toEqual(['one'])
})
it('does not navigate for an entry with no live members', () => {
  const onExit = vi.fn()
  const { result } = renderHook(() => useDiaryJump({ onExit }))
  act(() => result.current.initiateJump({ ...diary, memories: [] }))
  expect(onExit).not.toHaveBeenCalled()
  expect(usePendingFlyTargetStore.getState().nodeId).toBeNull()
})
