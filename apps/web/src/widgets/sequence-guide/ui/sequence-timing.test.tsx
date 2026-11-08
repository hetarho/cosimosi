// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineScript, useSequenceAnchorRegistry, type SequenceRect } from '@cosimosi/sequence'
import { useSequenceAnchorRegistration, useSequenceRun } from '@cosimosi/sequence/react'
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

describe('step anchor measurement', () => {
  const firstRect: SequenceRect = { x: 10, y: 20, width: 30, height: 40 }
  const nextRect: SequenceRect = { x: 110, y: 120, width: 130, height: 140 }
  const renderAnchorRun = (
    measureShared: () => Promise<SequenceRect | null>,
    {
      secondAnchor = 'shared',
      measureOther = async () => nextRect,
      registeredAnchor = 'shared',
    }: {
      secondAnchor?: string
      measureOther?: () => Promise<SequenceRect | null>
      registeredAnchor?: string
    } = {},
  ) => {
    vi.useFakeTimers()
    const anchorScript = defineScript({
      id: 'anchor-measurement',
      steps: [
        {
          id: 'first',
          caption: () => 'first',
          anchor: 'shared',
          advance: { on: 'signal' as const, signal: 'next' },
        },
        {
          id: 'second',
          caption: () => 'second',
          anchor: secondAnchor,
          advance: { on: 'signal' as const, signal: 'finish' },
        },
      ],
    })
    return renderHook(() => {
      useSequenceAnchorRegistration(registeredAnchor, () => measureShared())
      useSequenceAnchorRegistration('other', () => measureOther())
      return useSequenceRun(anchorScript, { captionDwellMs: 1000 })
    })
  }

  it('remeasures once when distinct steps keep the same registry map and anchor handle', async () => {
    let geometry = firstRect
    const measure = vi.fn(async () => geometry)
    const { result } = renderAnchorRun(measure)
    await act(async () => result.current.start('run'))
    expect(result.current.anchorRect).toEqual(firstRect)
    expect(measure).toHaveBeenCalledTimes(1)
    const anchors = useSequenceAnchorRegistry.getState().anchors
    const handle = anchors.get('shared')

    geometry = nextRect
    await act(async () => result.current.signal('next'))
    expect(result.current.step?.id).toBe('second')
    expect(result.current.progress.current).toBe(2)
    expect(useSequenceAnchorRegistry.getState().anchors).toBe(anchors)
    expect(useSequenceAnchorRegistry.getState().anchors.get('shared')).toBe(handle)
    expect(measure).toHaveBeenCalledTimes(2)
    expect(result.current.anchorRect).toEqual(nextRect)
  })

  it('measures a different anchor and retains settled geometry while its answer is pending', async () => {
    let resolve!: (rect: SequenceRect | null) => void
    const pending = new Promise<SequenceRect | null>((done) => {
      resolve = done
    })
    const measureShared = vi.fn(async () => firstRect)
    const measureOther = vi.fn(() => pending)
    const { result } = renderAnchorRun(measureShared, { secondAnchor: 'other', measureOther })
    try {
      await act(async () => result.current.start('run'))
      await act(async () => result.current.signal('next'))
      expect(result.current.step?.id).toBe('second')
      expect(result.current.anchorRect).toEqual(firstRect)
      await act(async () => resolve(nextRect))
      expect(measureShared).toHaveBeenCalledTimes(1)
      expect(measureOther).toHaveBeenCalledTimes(1)
      expect(result.current.anchorRect).toEqual(nextRect)
    } finally {
      await act(async () => resolve(null))
    }
  })

  it('does not measure again when unchanged inputs rerender', async () => {
    let geometry = firstRect
    const measure = vi.fn(async () => geometry)
    const { result, rerender } = renderAnchorRun(measure)
    await act(async () => result.current.start('run'))
    const anchors = useSequenceAnchorRegistry.getState().anchors
    const handle = anchors.get('shared')
    geometry = nextRect
    await act(async () => rerender())
    expect(useSequenceAnchorRegistry.getState().anchors).toBe(anchors)
    expect(useSequenceAnchorRegistry.getState().anchors.get('shared')).toBe(handle)
    expect(measure).toHaveBeenCalledTimes(1)
    expect(result.current.anchorRect).toEqual(firstRect)
  })

  it('measures again when the host explicitly requests it', async () => {
    let geometry = firstRect
    const measure = vi.fn(async () => geometry)
    const { result } = renderAnchorRun(measure)
    await act(async () => result.current.start('run'))
    geometry = nextRect
    await act(async () => result.current.remeasure())
    expect(result.current.step?.id).toBe('first')
    expect(measure).toHaveBeenCalledTimes(2)
    expect(result.current.anchorRect).toEqual(nextRect)
  })

  it('measures a replacement registry handle', async () => {
    const measure = vi.fn(async () => firstRect)
    const replacement = vi.fn(async () => nextRect)
    const { result } = renderAnchorRun(measure)
    await act(async () => result.current.start('run'))
    const anchors = useSequenceAnchorRegistry.getState().anchors
    await act(async () =>
      useSequenceAnchorRegistry.getState().register('shared', { measure: replacement }),
    )
    expect(useSequenceAnchorRegistry.getState().anchors).not.toBe(anchors)
    expect(measure).toHaveBeenCalledTimes(1)
    expect(replacement).toHaveBeenCalledTimes(1)
    expect(result.current.anchorRect).toEqual(nextRect)
  })

  it('keeps a run completable when the current anchor is missing', async () => {
    const measure = vi.fn(async () => firstRect)
    const { result } = renderAnchorRun(measure, { registeredAnchor: 'unrelated' })
    await act(async () => result.current.start('run'))
    expect(result.current.anchorRect).toBeNull()
    await act(async () => result.current.signal('next'))
    expect(result.current.step?.id).toBe('second')
    expect(result.current.anchorRect).toBeNull()
    await act(async () => result.current.signal('finish'))
    expect(result.current.outcome).toBe('completed')
    expect(result.current.active).toBe(false)
    expect(result.current.anchorRect).toBeNull()
    expect(measure).not.toHaveBeenCalled()
  })

  it('keeps a run completable when measurements return null or reject', async () => {
    const measureShared = vi.fn(async () => null)
    const measureOther = vi.fn(async () => {
      throw new Error('Unmeasurable anchor')
    })
    const { result } = renderAnchorRun(measureShared, { secondAnchor: 'other', measureOther })
    await act(async () => result.current.start('run'))
    expect(result.current.anchorRect).toBeNull()
    await act(async () => result.current.signal('next'))
    expect(result.current.step?.id).toBe('second')
    expect(result.current.anchorRect).toBeNull()
    await act(async () => result.current.signal('finish'))
    expect(result.current.outcome).toBe('completed')
    expect(result.current.active).toBe(false)
    expect(result.current.anchorRect).toBeNull()
    expect(measureShared).toHaveBeenCalledTimes(1)
    expect(measureOther).toHaveBeenCalledTimes(1)
  })

  it('discards a late answer after advancing to a different anchor', async () => {
    let resolve!: (rect: SequenceRect | null) => void
    const pending = new Promise<SequenceRect | null>((done) => {
      resolve = done
    })
    const measure = vi.fn(() => pending)
    const { result } = renderAnchorRun(measure, { secondAnchor: 'other' })
    try {
      await act(async () => result.current.start('run'))
      expect(result.current.anchorRect).toBeNull()
      await act(async () => result.current.signal('next'))
      expect(result.current.anchorRect).toEqual(nextRect)
      await act(async () => resolve(firstRect))
      expect(result.current.step?.id).toBe('second')
      expect(result.current.anchorRect).toEqual(nextRect)
      expect(measure).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => resolve(null))
    }
  })

  it('discards a pending measurement after unmount', async () => {
    let resolve!: (rect: SequenceRect | null) => void
    const pending = new Promise<SequenceRect | null>((done) => {
      resolve = done
    })
    const measure = vi.fn(() => pending)
    const { result, unmount } = renderAnchorRun(measure)
    try {
      await act(async () => result.current.start('run'))
      expect(result.current.anchorRect).toBeNull()
      const view = result.current
      unmount()
      expect(useSequenceAnchorRegistry.getState().anchors.size).toBe(0)
      await act(async () => resolve(firstRect))
      expect(result.current).toBe(view)
      expect(measure).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      await act(async () => resolve(null))
    }
  })
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
