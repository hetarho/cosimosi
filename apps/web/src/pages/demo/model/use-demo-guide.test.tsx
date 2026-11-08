// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSequenceAnchorRegistry, type SequenceRect } from '@cosimosi/sequence'

import type { DemoSurface } from './demo-surface.machine.ts'
import { useDemoGuide, type DemoGuideInputs } from './use-demo-guide.ts'

const WAY_OUT = 'recall-dismiss-action'
const RECALLED: DemoSurface = { kind: 'recall', memoryId: 'm1', applied: true }
const RECT_A: SequenceRect = { x: 857, y: 674, width: 62, height: 40 }
const RECT_B: SequenceRect = { x: 600, y: 500, width: 80, height: 44 }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

// The recall beat after its confirm landed: the ring's override target is the result's way out,
// and the engine's own step anchor (the closed panel's recall control) measures to nothing.
function recallWayOut(overrides: Partial<DemoGuideInputs> = {}): DemoGuideInputs {
  return {
    beat: 'recall',
    surface: RECALLED,
    decorationStage: 'sky',
    splitRevealed: null,
    memoryCount: 3,
    engineRect: null,
    remeasure: () => {},
    ...overrides,
  }
}

const register = (measure: () => Promise<SequenceRect | null>) =>
  act(() => useSequenceAnchorRegistry.getState().register(WAY_OUT, { measure }))

afterEach(() => {
  cleanup()
  useSequenceAnchorRegistry.getState().reset()
  vi.restoreAllMocks()
})

describe('useDemoGuide override target', () => {
  it('resolves a target set while unregistered once its anchor registers', async () => {
    const { result } = renderHook(() => useDemoGuide(recallWayOut()))
    await act(async () => {})
    expect(result.current.guideAnchorRect).toBeNull()
    expect(result.current.maskHole).toBeNull()

    register(async () => RECT_A)

    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_A))
    expect(result.current.maskHole).toEqual(RECT_A)
  })

  it('remeasures a replaced handle and drops the replaced handle’s pending answer', async () => {
    const stale = deferred<SequenceRect | null>()
    register(() => stale.promise)
    const { result } = renderHook(() => useDemoGuide(recallWayOut()))

    register(async () => RECT_B)
    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_B))

    await act(async () => stale.resolve(RECT_A))
    expect(result.current.guideAnchorRect).toEqual(RECT_B)
    expect(result.current.maskHole).toEqual(RECT_B)
  })

  it('does not remeasure on an unchanged rerender or another anchor’s registration', async () => {
    const measure = vi.fn(async () => RECT_A)
    register(measure)
    const inputs = recallWayOut()
    const { result, rerender } = renderHook((props: DemoGuideInputs) => useDemoGuide(props), {
      initialProps: inputs,
    })
    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_A))
    const settledCalls = measure.mock.calls.length

    rerender({ ...inputs })
    act(() =>
      useSequenceAnchorRegistry
        .getState()
        .register('recall-confirm-action', { measure: async () => RECT_B }),
    )
    await act(async () => {})

    expect(measure).toHaveBeenCalledTimes(settledCalls)
    expect(result.current.guideAnchorRect).toEqual(RECT_A)
  })

  it('remeasures on the guide’s remeasure while the engine rect stays null', async () => {
    let rect = RECT_A
    const remeasure = vi.fn()
    register(async () => rect)
    const { result } = renderHook(() => useDemoGuide(recallWayOut({ remeasure })))
    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_A))

    rect = RECT_B
    act(() => result.current.remeasure())

    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_B))
    expect(result.current.maskHole).toEqual(RECT_B)
    expect(remeasure).toHaveBeenCalled()
  })

  it('clears the rect when the target unregisters, ignoring its in-flight measure', async () => {
    const pending = deferred<SequenceRect | null>()
    register(async () => RECT_A)
    const { result } = renderHook(() => useDemoGuide(recallWayOut()))
    await waitFor(() => expect(result.current.guideAnchorRect).toEqual(RECT_A))

    register(() => pending.promise)
    act(() => useSequenceAnchorRegistry.getState().unregister(WAY_OUT))
    expect(result.current.guideAnchorRect).toBeNull()

    await act(async () => pending.resolve(RECT_B))
    expect(result.current.guideAnchorRect).toBeNull()
    await waitFor(() => expect(result.current.maskHole).toBeNull())
  })

  it('writes nothing after unmount when a measure resolves late', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<SequenceRect | null>()
    register(() => pending.promise)
    const { result, unmount } = renderHook(() => useDemoGuide(recallWayOut()))
    const beforeUnmount = result.current

    unmount()
    await act(async () => pending.resolve(RECT_A))

    expect(result.current).toBe(beforeUnmount)
    expect(result.current.guideAnchorRect).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
