import { useEffect, useRef, useState } from 'react'

import {
  clearCaptionObstacles,
  type CaptionPosition,
  type SequenceRect,
  type SequenceViewport,
} from '@cosimosi/sequence'
import { SHEET_BREAKPOINT, SURFACE_PANEL_ATTR } from '@cosimosi/ui'

import { awaitArrival, measuredBox } from '../../../shared/lib/measure-arrival.ts'

const CLEARANCE = '--surface-top-clearance'
const CONTROLS =
  'button, a[href], input, textarea, select, [contenteditable="true"], [role="button"], [role="slider"]'
const PANEL = `[${SURFACE_PANEL_ATTR}]`

/** The surfaces that decide the caption's room: the topmost modal and the marked panels. */
interface RoomSurfaces {
  readonly modal: Element | null
  readonly panels: readonly Element[]
}

/** DOM measurements belong to the guide; the reusable placement policy stays platform neutral. */
export function useCaptionLayout({
  active,
  text,
  preferred,
  viewport,
  right,
  anchorRect,
  onRemeasure,
}: {
  readonly active: boolean
  readonly text: string | null
  readonly preferred: CaptionPosition
  readonly viewport: SequenceViewport
  readonly right: number
  readonly anchorRect: SequenceRect | null
  readonly onRemeasure: () => void
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const key = JSON.stringify([text, preferred, viewport, right, anchorRect])
  const [layout, setLayout] = useState<{ key: string; position: CaptionPosition } | null>(null)
  // The surfaces the placed line was measured among. The line is visible only while `layout`
  // matches the key, and that state commits together with its position, so it never paints at the
  // fallback first. A change of surfaces is a new room and hides it until it is measured there;
  // anything else (a font swap, a size tick, a scroll) re-measures it where it stands.
  const placedRoom = useRef<RoomSurfaces | null>(null)

  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const previous = root.style.getPropertyValue(CLEARANCE)
    return () => {
      if (previous) root.style.setProperty(CLEARANCE, previous)
      else root.style.removeProperty(CLEARANCE)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    let live = true
    let frame = 0
    let revision = 0
    const observed = new Set<Element>()
    const root = document.documentElement
    const resize =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())
    const reserve = (height: number) => {
      const value = height ? `${Math.ceil(height)}px` : ''
      if (root.style.getPropertyValue(CLEARANCE) === value) return
      if (value) root.style.setProperty(CLEARANCE, value)
      else root.style.removeProperty(CLEARANCE)
      onRemeasure()
    }
    const measure = async (version: number) => {
      const panels = [...document.querySelectorAll(PANEL)]
      await Promise.all(panels.map(awaitArrival))
      if (!live || version !== revision) return
      const paragraph = ref.current
      if (!paragraph || !text) {
        if (!panels.length) reserve(0)
        return
      }
      const width = paragraph.offsetWidth || Math.min(512, viewport.width - right - 48)
      const height = paragraph.offsetHeight || 112
      const x = (viewport.width - right - width) / 2
      const { modal } = roomSurfaces()
      const controls = [...(modal ?? document).querySelectorAll(CONTROLS)].filter(
        (node) => !node.closest('[data-sequence-chrome]') && visible(node),
      )
      const bottomSheet = !modal && viewport.width < SHEET_BREAKPOINT.px && panels.some(visible)
      let top = 64
      if (bottomSheet) {
        // The clock and exit actions above a non-modal sheet remain available.
        for (const node of controls) {
          if (node.closest(PANEL)) continue
          const box = measuredBox(node)
          if (box && box.y < viewport.height * 0.25 && box.x < x + width && box.x + box.width > x)
            top = Math.max(top, box.y + box.height + 12)
        }
      }
      reserve(modal || bottomSheet ? top + height + 12 : 0)
      // Read AFTER reserving the band: the modal body now scrolls within the remaining room.
      const obstacles = controls.flatMap((node) => clippedBox(node, viewport))
      for (const panel of panels) {
        const box = measuredBox(panel)
        if (box && visible(panel)) obstacles.push(box)
      }
      if (anchorRect && !modal) obstacles.push(anchorRect)
      const position = clearCaptionObstacles({
        preferred: modal ? { from: 'top', insetPx: top } : preferred,
        viewport,
        caption: { x, width, height },
        obstacles,
      })
      placedRoom.current = { modal, panels }
      setLayout((previous) =>
        previous?.key === key && JSON.stringify(previous.position) === JSON.stringify(position)
          ? previous
          : { key, position },
      )
      for (const node of [paragraph, ...panels]) {
        if (observed.has(node)) continue
        observed.add(node)
        resize?.observe(node)
      }
      for (const node of observed) {
        if (node.isConnected) continue
        resize?.unobserve(node)
        observed.delete(node)
      }
    }
    function schedule() {
      const placed = placedRoom.current
      if (placed && !sameRoom(placed, roomSurfaces())) {
        placedRoom.current = null
        setLayout(null)
      }
      remeasure()
    }
    function remeasure() {
      const version = ++revision
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        void measure(version)
      })
    }
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    remeasure()
    return () => {
      live = false
      cancelAnimationFrame(frame)
      mutations.disconnect()
      resize?.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [active, text, key, preferred, viewport, right, anchorRect, onRemeasure])

  return {
    ref,
    position: layout?.key === key ? layout.position : preferred,
    ready: layout?.key === key,
  }
}

function roomSurfaces(): RoomSurfaces {
  return {
    modal: [...document.querySelectorAll('[aria-modal="true"]')].at(-1) ?? null,
    panels: [...document.querySelectorAll(PANEL)],
  }
}

function sameRoom(a: RoomSurfaces, b: RoomSurfaces): boolean {
  return (
    a.modal === b.modal &&
    a.panels.length === b.panels.length &&
    a.panels.every((panel, index) => panel === b.panels[index])
  )
}

function visible(node: Element): boolean {
  const style = getComputedStyle(node)
  return style.visibility !== 'hidden' && style.display !== 'none' && !!measuredBox(node)
}

function clippedBox(node: Element, viewport: SequenceViewport): SequenceRect[] {
  const box = measuredBox(node)
  if (!box) return []
  let top = Math.max(0, box.y)
  let bottom = Math.min(viewport.height, box.y + box.height)
  // Controls scrolled out of a panel's body do not occupy its header or the guide above it.
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (!/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) continue
    const bounds = measuredBox(parent)
    if (bounds) {
      top = Math.max(top, bounds.y)
      bottom = Math.min(bottom, bounds.y + bounds.height)
    }
  }
  return bottom > top ? [{ ...box, y: top, height: bottom - top }] : []
}
