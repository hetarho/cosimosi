// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletionScope } from '@cosimosi/auth/scope'
import {
  ALTERNATIVE_MOOD_COLORS,
  defaultMoodPalette,
  defineMoodPalette,
  resolvePalette,
  setMoodPalette,
} from '@cosimosi/emotion'
import { useEpisodicMemoryStore } from '@cosimosi/universe'

import { useDemoSandbox } from './use-demo-sandbox.ts'

afterEach(cleanup)

describe('useDemoSandbox', () => {
  it('clears the universe on entry and leave without fencing a signed-in visitor', () => {
    useEpisodicMemoryStore.setState({ byId: { memory: {} as never }, ids: ['memory'] })
    const inFlight = createCompletionScope().capture()
    const startRun = vi.fn()

    const { unmount } = renderHook(() => useDemoSandbox('run-1', startRun))

    expect(useEpisodicMemoryStore.getState().ids).toEqual([])
    expect(startRun).toHaveBeenCalledWith('run-1')
    expect(inFlight()).toBe(true)

    setMoodPalette(defineMoodPalette('tasted', ALTERNATIVE_MOOD_COLORS))
    unmount()

    expect(resolvePalette()).toBe(defaultMoodPalette)
    expect(inFlight()).toBe(true)
  })
})
