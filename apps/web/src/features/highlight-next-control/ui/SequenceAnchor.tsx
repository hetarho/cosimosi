import { useCallback, useRef, type ReactNode } from 'react'

import type { SequenceRect } from '@cosimosi/sequence'
import { useSequenceAnchorRegistration } from '@cosimosi/sequence/react'

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
export function SequenceAnchor({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  const measure = useCallback(async (): Promise<SequenceRect | null> => {
    const node = ref.current
    if (!node) return null
    // `display: contents` gives the wrapper itself no box, so the rect is taken from the child.
    const target = node.firstElementChild ?? node
    const box = target.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) return null
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }, [])

  useSequenceAnchorRegistration(id, measure)

  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
