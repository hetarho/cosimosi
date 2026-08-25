import { useEffect, useState } from 'react'

import type { SequenceRect, SequenceViewport } from '@cosimosi/sequence'
import { SURFACE_PANEL_ATTR } from '@cosimosi/ui'

import { awaitArrival, measuredBox } from '../../../shared/lib/measure-arrival.ts'

// widgets/sequence-guide lib: the surface the caption has to stay off, measured rather than named.
//
// This is the whole reason the caption's placement needs no per-panel band. A page does not tell the
// chrome "the recall sheet is open, put the line at the top"; the chrome looks at what is on screen,
// finds the panel that owns the bottom edge, and clears its top edge by one gap. A panel the guide
// has never heard of gets the same treatment, and a panel that is dragged taller keeps it.
//
// What counts is a marked panel FLUSH with the bottom edge and spanning the full width — the bottom
// sheet shape, and only it. The same primitives in their wide-screen shapes are deliberately not
// obstructions: a centred modal leaves both edges free, and a right-edge panel leaves the centred
// band the caption renders in untouched.

/** How far from an edge still counts as flush, absorbing subpixel layout and the safe-area inset. */
const FLUSH_TOLERANCE_PX = 2

export function useBottomSurface(active: boolean, viewport: SequenceViewport): SequenceRect | null {
  const [surface, setSurface] = useState<SequenceRect | null>(null)

  useEffect(() => {
    if (!active) return

    let live = true
    let scheduled = false
    const read = () => {
      scheduled = false
      void measureBottomSurface().then((next) => {
        // Compared rather than assigned: a surface that has not moved must not re-render the chrome,
        // because a mutation observer over a live page fires far more often than the layout changes.
        if (live) setSurface((current) => (sameRect(current, next) ? current : next))
      })
    }
    // Coalesced to one frame: a React commit that opens a panel arrives as a burst of mutations, and
    // measuring per mutation would read the same half-arrived panel many times over.
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(read)
    }

    read()
    // A surface is a portal into `body`, so the tree it appears in is not the one this widget
    // renders — an observer is the only way the chrome hears about it.
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      live = false
      observer.disconnect()
    }
    // `viewport` re-reads on a resize or an orientation change, where the same panel is a different
    // shape and may stop being a bottom sheet at all.
  }, [active, viewport])

  // Read through the flag rather than cleared by it: an inactive run has no surface to clear, and
  // clearing state as an effect's first act is a cascading render for an answer already known here.
  return active ? surface : null
}

// The topmost bottom-edge panel on screen, as one rect. Topmost rather than merged: the caption
// clears whichever panel reaches highest, and stacked sheets share a bottom edge anyway.
async function measureBottomSurface(): Promise<SequenceRect | null> {
  const panels = [...document.querySelectorAll(`[${SURFACE_PANEL_ATTR}]`)]
  if (panels.length === 0) return null
  await Promise.all(panels.map((panel) => awaitArrival(panel)))
  let highest: SequenceRect | null = null
  for (const panel of panels) {
    if (!panel.isConnected) continue
    const box = measuredBox(panel)
    if (!box || !ownsBottomEdge(box)) continue
    if (!highest || box.y < highest.y) highest = box
  }
  return highest
}

function ownsBottomEdge(box: SequenceRect): boolean {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const spansWidth = box.x <= FLUSH_TOLERANCE_PX && box.width >= viewportWidth - FLUSH_TOLERANCE_PX
  const reachesBottom = box.y + box.height >= viewportHeight - FLUSH_TOLERANCE_PX
  return spansWidth && reachesBottom && box.y < viewportHeight
}

function sameRect(a: SequenceRect | null, b: SequenceRect | null): boolean {
  if (!a || !b) return a === b
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
