// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createActor } from 'xstate'
import type { EpisodicMemory } from '@cosimosi/memory'
import { universeNavigationMachine } from '../universe-navigation.machine.ts'
import { useDiaryMemoryNavigationStore } from '../diary-memory-navigation-store.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useSpotlightStore } from '../spotlight-store.ts'
import { resetUniverseUserState } from '../user-state-reset.ts'
import { useDiaryMemoryNavigation } from './use-diary-memory-navigation.ts'

const memories = ['one', 'two', 'three'].map((id) => ({ id }) as EpisodicMemory)
beforeEach(() => {
  resetUniverseUserState()
  useEpisodicMemoryStore.getState().reconcile(memories)
  useDiaryMemoryNavigationStore.getState().start(['one', 'two', 'three'])
})
afterEach(cleanup)
it('moves the selection, camera and spotlight in both directions and stops at endpoints', () => {
  const actor = createActor(universeNavigationMachine).start()
  actor.send({ type: 'SELECT', nodeId: 'one' })
  const { result } = renderHook(() => useDiaryMemoryNavigation(actor))
  expect(result.current).toMatchObject({ position: 1, total: 3, hasPrevious: false, hasNext: true })
  act(() => {
    result.current.next()
    result.current.next()
  })
  expect(actor.getSnapshot().context).toMatchObject({
    selectedNodeId: 'three',
    travelNodeId: 'three',
  })
  expect(useSpotlightStore.getState().memoryIds).toEqual(['three'])
  expect(result.current).toMatchObject({ position: 3, hasNext: false })
  act(() => result.current.next())
  expect(actor.getSnapshot().context.selectedNodeId).toBe('three')
  act(() => result.current.previous())
  expect(actor.getSnapshot().context.selectedNodeId).toBe('two')
  actor.stop()
})
it('skips members removed by a refetch and ends when another diary is selected', () => {
  const actor = createActor(universeNavigationMachine).start()
  actor.send({ type: 'SELECT', nodeId: 'one' })
  const { result } = renderHook(() => useDiaryMemoryNavigation(actor))
  act(() => useEpisodicMemoryStore.getState().reconcile([memories[0], memories[2]]))
  act(() => result.current.next())
  expect(actor.getSnapshot().context.selectedNodeId).toBe('three')
  expect(result.current).toMatchObject({ position: 2, total: 2 })
  act(() => actor.send({ type: 'SELECT', nodeId: 'unrelated' }))
  expect(useDiaryMemoryNavigationStore.getState().memoryIds).toEqual([])
  actor.stop()
})
it('clears the collection on close and on an account reset', () => {
  const actor = createActor(universeNavigationMachine).start()
  actor.send({ type: 'SELECT', nodeId: 'one' })
  const { result } = renderHook(() => useDiaryMemoryNavigation(actor))
  act(() => result.current.clear())
  expect(result.current.active).toBe(false)
  act(() => useDiaryMemoryNavigationStore.getState().start(['one', 'two']))
  act(() => resetUniverseUserState())
  expect(useDiaryMemoryNavigationStore.getState().memoryIds).toEqual([])
  actor.stop()
})
