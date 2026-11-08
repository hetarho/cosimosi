// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineScript, useSequenceAnchorRegistry } from '@cosimosi/sequence'
import { useSequenceRun } from '@cosimosi/sequence/react'
import { VALUES } from '@cosimosi/config'

const script = defineScript({
  id: 'reading',
  steps: [
    { id: 'scene', caption: () => 'scene', advance: { on: 'signal' as const, signal: 'landed' } },
    { id: 'reading', caption: () => 'reading', advance: { on: 'dwell' as const } },
    { id: 'next', caption: () => 'next', advance: { on: 'dwell' as const } },
  ],
})
afterEach(() => {
  try {
    cleanup()
    expect(vi.getTimerCount()).toBe(0)
    expect(useSequenceAnchorRegistry.getState().anchors.size).toBe(0)
    expect(document.body.childElementCount).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

describe('fresh run reading ownership', () => {
  const dwell = 1000
  const elapsed = 900
  const readingScript = defineScript({
    id: 'fresh-reading',
    steps: [
      { id: 'reading', caption: () => 'reading', advance: { on: 'dwell' as const } },
      {
        id: 'waiting',
        caption: () => 'waiting',
        advance: { on: 'signal' as const, signal: 'next' },
      },
    ],
  })
  const renderReadingRun = (paused = false) =>
    renderHook(
      ({ paused: hidden }) =>
        useSequenceRun(readingScript, { captionDwellMs: dwell, paused: hidden }),
      { initialProps: { paused } },
    )

  it('gives a fresh active run its full dwell when START keeps the same step index', () => {
    vi.useFakeTimers()
    const { result } = renderReadingRun()
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(elapsed))
    expect(result.current.step?.id).toBe('reading')
    act(() => result.current.start('run-B'))
    act(() => vi.advanceTimersByTime(dwell - elapsed))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(elapsed - 1))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.step?.id).toBe('waiting')
  })

  it('advances an uninterrupted dwell once, then waits for its signal', () => {
    vi.useFakeTimers()
    const { result } = renderReadingRun()
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(dwell - 1))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.step?.id).toBe('waiting')
    act(() => vi.advanceTimersByTime(dwell * 3))
    expect(result.current.step?.id).toBe('waiting')
  })

  it('cancels a skipped run and gives its replay a full dwell', () => {
    vi.useFakeTimers()
    const { result } = renderReadingRun()
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(elapsed))
    act(() => result.current.skip())
    expect(result.current.outcome).toBe('skipped')
    expect(vi.getTimerCount()).toBe(0)
    act(() => result.current.start('run-B'))
    act(() => vi.advanceTimersByTime(dwell - 1))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.step?.id).toBe('waiting')
  })

  it('gives a paused fresh run its full dwell after the host reveals it', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderReadingRun(true)
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(dwell * 2))
    act(() => result.current.start('run-B'))
    act(() => vi.advanceTimersByTime(dwell))
    expect(result.current.step?.id).toBe('reading')
    expect(vi.getTimerCount()).toBe(0)
    rerender({ paused: false })
    act(() => vi.advanceTimersByTime(dwell - 1))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.step?.id).toBe('waiting')
  })

  it('keeps the original deadline when the same inputs rerender', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderReadingRun()
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(elapsed))
    rerender({ paused: false })
    act(() => vi.advanceTimersByTime(dwell - elapsed - 1))
    expect(result.current.step?.id).toBe('reading')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.step?.id).toBe('waiting')
  })

  it('removes pending dwell work on unmount', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderReadingRun()
    act(() => result.current.start('run-A'))
    act(() => vi.advanceTimersByTime(elapsed))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(dwell * 3))
    expect(vi.getTimerCount()).toBe(0)
    expect(result.current.step?.id).toBe('reading')
  })
})

describe('caption reading time', () => {
  it.each([VALUES.sequence.captionDwellMs, VALUES.demo.captionDwellMs])(
    'gives a hidden caption its full %ims dwell once the host reveals it',
    (dwell) => {
      vi.useFakeTimers()
      const { result, rerender } = renderHook(
        ({ paused }) => useSequenceRun(script, { captionDwellMs: dwell, paused }),
        { initialProps: { paused: true } },
      )
      act(() => result.current.start('run'))
      act(() => result.current.signal('landed'))
      act(() => vi.advanceTimersByTime(10000))
      expect(result.current.step?.id).toBe('reading')
      rerender({ paused: false })
      act(() => vi.advanceTimersByTime(dwell - 1))
      expect(result.current.step?.id).toBe('reading')
      act(() => vi.advanceTimersByTime(1))
      expect(result.current.step?.id).toBe('next')
    },
  )

  it('keeps skip usable while the host shows a scene and clears the pending dwell', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useSequenceRun(script, { captionDwellMs: 4500, paused: true }),
    )
    act(() => result.current.start('run'))
    act(() => result.current.skip())
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current.outcome).toBe('skipped')
    expect(result.current.active).toBe(false)
  })
})
