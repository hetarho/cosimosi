import { useCallback, useRef, type ReactNode } from 'react'

import type { SequenceRect } from '@cosimosi/sequence'
import { useSequenceAnchorRegistration } from '@cosimosi/sequence/react'

import { awaitArrival, measuredBox } from '../../../shared/lib/measure-arrival.ts'

// features/highlight-next-control ui: the register wrapper a HOST wraps an existing child with —
// `<SequenceAnchor id="write-diary"><WritingFlowSheet /></SequenceAnchor>`.
//
// Anchors are registered at composition sites and nowhere else. That single rule is what keeps
// `features/write-diary`, `features/recall-star` and every other shipped slice completely unaware
// that a sequence exists — the same discipline that forbids a demo flag in shared code. Its
// consequence is that the highlight's grain is the control CLUSTER a page already lays out, which is
// the right grain for a spotlight anyway.
//
// It renders a plain `display: contents` wrapper, so wrapping a child changes no layout: the host's
// flex/grid still sees the child directly.
//
// The measure is asynchronous because on this platform it has to be: a control inside a surface that
// is still sliding in reads at the position the surface is leaving, and the engine measures on mount
// — so a rect taken eagerly would be a panel-height off on every narrow screen and re-measured by
// nothing afterwards. `awaitArrival` is what the promise in the registry's handle is FOR.
export function SequenceAnchor({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  const measure = useCallback(async (): Promise<SequenceRect | null> => {
    const node = ref.current
    if (!node) return null
    // `display: contents` gives the wrapper itself no box, so the rect is taken from the child.
    const target = node.firstElementChild ?? node
    await awaitArrival(target)
    // The wait spans commits, so the tree may have moved on. A detached node has no position worth
    // reporting, and the registry's caller drops a late answer anyway.
    return target.isConnected ? measuredBox(target) : null
  }, [])

  useSequenceAnchorRegistration(id, measure)

  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
