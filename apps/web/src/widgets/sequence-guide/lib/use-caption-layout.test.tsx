// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CAPTION_EYELINE, type CaptionPosition } from '@cosimosi/sequence'

import { SequenceCaption } from '../ui/SequenceCaption.tsx'
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

  it('hides the whole band, not only its line, until the place is ready', () => {
    const props = { caption: () => '한 줄의 안내예요.', position: EYELINE }
    const { container, rerender } = render(
      createElement(SequenceCaption, { ...props, ready: false }),
    )
    const band = container.querySelector<HTMLElement>('[aria-live="polite"]')!
    expect(band.style.visibility).toBe('hidden')
    rerender(createElement(SequenceCaption, { ...props, ready: true }))
    expect(band.style.visibility).toBe('visible')
  })
})
