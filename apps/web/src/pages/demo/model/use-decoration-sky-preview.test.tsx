// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VALUES } from '@cosimosi/config'
import { useDecorationSkyPreview } from './use-decoration-sky-preview.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const delay = VALUES.demo.decorationSkyPreviewMs
describe('changed sky preview time', () => {
  it('keeps the overview for the full preview before handing off', () => {
    vi.useFakeTimers()
    const next = vi.fn()
    renderHook(() => useDecorationSkyPreview('sky-preview', 'soft-aurora', true, next))
    act(() => vi.advanceTimersByTime(delay - 1))
    expect(next).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(next).toHaveBeenCalledTimes(1)
  })
  it('restarts the preview when another sky is selected', () => {
    vi.useFakeTimers()
    const next = vi.fn()
    const { rerender } = renderHook(
      ({ sky }) => useDecorationSkyPreview('sky-preview', sky, true, next),
      { initialProps: { sky: 'soft-aurora' } },
    )
    act(() => vi.advanceTimersByTime(delay / 2))
    rerender({ sky: 'iridescence' })
    act(() => vi.advanceTimersByTime(delay / 2))
    expect(next).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(delay / 2))
    expect(next).toHaveBeenCalledTimes(1)
  })
  it('cancels the handoff when the guide closes or unmounts', () => {
    vi.useFakeTimers()
    const next = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ active }) => useDecorationSkyPreview('sky-preview', 'soft-aurora', active, next),
      { initialProps: { active: true } },
    )
    rerender({ active: false })
    act(() => vi.advanceTimersByTime(delay * 2))
    expect(next).not.toHaveBeenCalled()
    rerender({ active: true })
    unmount()
    act(() => vi.advanceTimersByTime(delay * 2))
    expect(next).not.toHaveBeenCalled()
  })
})
