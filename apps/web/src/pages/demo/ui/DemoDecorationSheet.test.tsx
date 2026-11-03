// @vitest-environment jsdom
import { useCallback, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setActiveLocale, m } from '../../../shared/i18n/index.ts'
import type { DemoTaste } from '../model/use-demo-run.ts'
import { DemoDecorationSheet } from './DemoDecorationSheet.tsx'
import { advanceDecorationTour, type DecorationTourStage } from '../model/decoration-tour.ts'
import { DEFAULT_SKY_EFFECT, DEFAULT_STAR_SHAPE } from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { useDecorationSkyPreview } from '../model/use-decoration-sky-preview.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('the decorating tutorial return', () => {
  it('ignores current defaults, shows the changed sky, then waits for a different shape', () => {
    vi.useFakeTimers()
    setActiveLocale('en')
    const closed = vi.fn()
    function Host() {
      const [open, setOpen] = useState(true)
      const [taste, setTaste] = useState<DemoTaste>({
        background: null,
        bodyShape: null,
        summaryShape: null,
        mote: null,
        moteField: null,
        palette: false,
      })
      const [stage, setStage] = useState<DecorationTourStage>('sky')
      const finishPreview = useCallback(
        () => setStage((current) => (current === 'sky-preview' ? 'shape' : current)),
        [],
      )
      useDecorationSkyPreview(stage, taste.background, open, finishPreview)
      return (
        <DemoDecorationSheet
          open={open}
          phase={{ kind: 'tutorial', beatId: 'ornament_taster' }}
          taste={taste}
          canClose={stage === 'finish'}
          tourStage={stage}
          onApplyOrnament={(surface, key) => {
            setTaste((current) => ({ ...current, [surface]: key }))
            const fallback =
              surface === 'background'
                ? DEFAULT_SKY_EFFECT
                : surface === 'bodyShape'
                  ? DEFAULT_STAR_SHAPE
                  : null
            setStage((stage) =>
              advanceDecorationTour(stage, surface, taste[surface] ?? fallback, key ?? fallback),
            )
          }}
          onApplyPalette={() => {}}
          onClose={() => {
            setOpen(false)
            closed()
          }}
        />
      )
    }
    render(<Host />)
    const done = screen.getByRole('button', {
      name: m.demo_decorate_done_action(),
    }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Grainient' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Grainient' }))
    expect(done.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Soft Aurora' }))
    expect(done.disabled).toBe(true)
    expect(document.querySelector('[data-demo-decoration-stage="sky-preview"]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(VALUES.demo.decorationSkyPreviewMs - 1))
    expect(document.querySelector('[data-demo-decoration-stage="shape"]')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('[data-demo-decoration-stage="shape"]')).not.toBeNull()
    fireEvent.click(
      document.querySelector('[data-sequence-anchor="ornament-shape-action"] button')!,
    )
    expect(done.disabled).toBe(false)
    expect(screen.getByRole('button', { name: /Soft Aurora/ }).getAttribute('aria-current')).toBe(
      'true',
    )
    fireEvent.click(done)
    expect(closed).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(240))
    expect(screen.queryByRole('button', { name: m.demo_decorate_done_action() })).toBeNull()
  })
})
