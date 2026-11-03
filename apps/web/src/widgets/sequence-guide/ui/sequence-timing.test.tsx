// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineScript } from '@cosimosi/sequence'
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
  cleanup()
  vi.useRealTimers()
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
