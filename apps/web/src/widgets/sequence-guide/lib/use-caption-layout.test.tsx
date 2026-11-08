// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CAPTION_EYELINE, type CaptionPosition } from '@cosimosi/sequence'

import { SequenceCaption } from '../ui/SequenceCaption.tsx'
import { SequenceGuide } from '../ui/SequenceGuide.tsx'
import { useCaptionLayout } from './use-caption-layout.ts'

const VIEWPORT = { width: 390, height: 844 }
const EYELINE: CaptionPosition = { from: 'midline', fraction: CAPTION_EYELINE }
const noop = () => {}

// What the paragraph shows at each moment its attributes change: whether it is visible, and the
// room the rendered position came from. The caption may only ever be visible at a measured place.
interface Painted {
  readonly visible: boolean
  readonly from: string | null
}

function Caption() {
  const layout = useCaptionLayout({
    active: true,
    text: '한 줄의 안내예요.',
    preferred: EYELINE,
    viewport: VIEWPORT,
    right: 0,
    anchorRect: null,
    onRemeasure: noop,
  })
  return createElement(
    'p',
    {
      ref: layout.ref,
      'data-from': layout.position.from,
      style: { visibility: layout.ready ? 'visible' : 'hidden' },
    },
    '한 줄의 안내예요.',
  )
}

// Replays every attribute change of the paragraph in order, so a state that lived between two React
// commits (an imperative reveal before the position commits) is seen, not just the final one.
function watchPaintedStates(paragraph: Element) {
  const states: Painted[] = []
  const read = (style: string | null, from: string | null): Painted => ({
    visible: !/visibility:\s*hidden/.test(style ?? ''),
    from,
  })
  let style = paragraph.getAttribute('style')
  let from = paragraph.getAttribute('data-from')
  states.push(read(style, from))
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === 'style') style = paragraph.getAttribute('style')
      if (record.attributeName === 'data-from') from = paragraph.getAttribute('data-from')
    }
    states.push(read(style, from))
  })
  observer.observe(paragraph, { attributes: true, attributeFilter: ['style', 'data-from'] })
  return { states, stop: () => observer.disconnect() }
}

const nextFrame = () =>
  act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await Promise.resolve()
  })

function openModal() {
  const modal = document.createElement('div')
  modal.setAttribute('aria-modal', 'true')
  document.body.append(modal)
  return modal
}

const resizeTicks: Array<() => void> = []

beforeEach(() => {
  resizeTicks.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeTicks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  document.documentElement.style.removeProperty('--surface-top-clearance')
  vi.unstubAllGlobals()
})

describe('useCaptionLayout', () => {
  it('shows the caption first at its measured place, never at the fallback', async () => {
    openModal()
    const { container } = render(createElement(Caption))
    const paragraph = container.querySelector('p')!
    const watch = watchPaintedStates(paragraph)

    await nextFrame()
    await nextFrame()
    watch.stop()

    const visible = watch.states.filter((state) => state.visible)
    expect(visible.length).toBeGreaterThan(0)
    // An open modal sends the line to the top band; the fallback is the eyeline.
    expect(visible.every((state) => state.from === 'top')).toBe(true)
    expect(paragraph.getAttribute('data-from')).toBe('top')
  })

  it('keeps a placed caption visible through a size tick', async () => {
    const { container } = render(createElement(Caption))
    const paragraph = container.querySelector('p')!
    await nextFrame()
    await nextFrame()
    expect(paragraph.style.visibility).toBe('visible')
    expect(resizeTicks.length).toBeGreaterThan(0)

    const watch = watchPaintedStates(paragraph)
    act(() => resizeTicks.forEach((tick) => tick()))
    await nextFrame()
    await nextFrame()
    watch.stop()

    expect(watch.states.every((state) => state.visible)).toBe(true)
    expect(paragraph.style.visibility).toBe('visible')
  })

  it('hides on a room change, then shows at the new place', async () => {
    const { container } = render(createElement(Caption))
    const paragraph = container.querySelector('p')!
    await nextFrame()
    await nextFrame()
    expect(paragraph.getAttribute('data-from')).toBe('midline')
    expect(paragraph.style.visibility).toBe('visible')

    const watch = watchPaintedStates(paragraph)
    await act(async () => {
      openModal()
      await Promise.resolve()
    })
    await nextFrame()
    await nextFrame()
    watch.stop()

    const firstHidden = watch.states.findIndex((state) => !state.visible)
    expect(firstHidden).toBeGreaterThanOrEqual(0)
    const shownAfter = watch.states.slice(firstHidden).filter((state) => state.visible)
    expect(shownAfter.length).toBeGreaterThan(0)
    expect(shownAfter.every((state) => state.from === 'top')).toBe(true)
    expect(paragraph.style.visibility).toBe('visible')
  })

  it('hides the positioned band until the place is ready, never the live region', () => {
    const props = { caption: () => '한 줄의 안내예요.', position: EYELINE }
    const { container, rerender } = render(
      createElement(SequenceCaption, { ...props, ready: false }),
    )
    const live = container.querySelector<HTMLElement>('[aria-live="polite"]')!
    const band = live.querySelector<HTMLElement>('[data-sequence-caption-band]')!
    expect(band.style.visibility).toBe('hidden')
    expect(getComputedStyle(live).visibility).not.toBe('hidden')
    rerender(createElement(SequenceCaption, { ...props, ready: true }))
    expect(band.style.visibility).toBe('visible')
  })

  it('keeps the live region exposed while its line changes in place', async () => {
    const props = {
      active: true,
      anchorRect: null,
      progress: { current: 1, total: 3 },
      onSkip: noop,
      onRemeasure: noop,
    }
    const { container, rerender } = render(
      createElement(SequenceGuide, { ...props, caption: () => '첫 줄이에요.' }),
    )
    const live = container.querySelector<HTMLElement>('[aria-live="polite"]')!
    const hidden: boolean[] = []
    const check = () => hidden.push(getComputedStyle(live).visibility === 'hidden')
    check()
    const observer = new MutationObserver(check)
    observer.observe(live, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    })
    await nextFrame()
    await nextFrame()
    rerender(createElement(SequenceGuide, { ...props, caption: () => '다음 줄이에요.' }))
    await nextFrame()
    await nextFrame()
    observer.disconnect()

    expect(container.querySelector('[aria-live="polite"]')).toBe(live)
    expect(live.textContent).toContain('다음 줄이에요.')
    expect(hidden.length).toBeGreaterThan(1)
    expect(hidden.every((state) => !state)).toBe(true)
    const band = live.querySelector<HTMLElement>('[data-sequence-caption-band]')!
    expect(band.style.visibility).toBe('visible')
  })
})
