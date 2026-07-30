import { useCallback, useRef, type ReactNode } from 'react'
import { View, type View as ViewType } from 'react-native'

import type { SequenceRect } from '@cosimosi/sequence'
import { useSequenceAnchorRegistration } from '@cosimosi/sequence/react'

// features/highlight-next-control ui (RN fork): the register wrapper a HOST wraps an existing child
// with — `<SequenceAnchor id="write-diary"><WritingFlowSheet /></SequenceAnchor>`.
//
// Anchors are registered at composition sites and nowhere else. That single rule is what keeps
// `features/write-diary`, `features/recall-star` and every other shipped slice completely unaware
// that a sequence exists.
//
// This is the fork that justifies the seam's promise return type: `measureInWindow` is callback-based,
// so a synchronous `measure()` could not have served both platforms.
export function SequenceAnchor({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<ViewType | null>(null)

  const measure = useCallback(
    () =>
      new Promise<SequenceRect | null>((resolve) => {
        const node = ref.current
        if (!node) {
          resolve(null)
          return
        }
        node.measureInWindow((x, y, width, height) => {
          // A zero box means the view is laid out but not on screen — no rect rather than a ring
          // drawn in the corner.
          resolve(width === 0 && height === 0 ? null : { x, y, width, height })
        })
      }),
    [],
  )

  useSequenceAnchorRegistration(id, measure)

  // `collapsable={false}` keeps the wrapper a real native view, so it stays measurable — RN otherwise
  // optimizes a layout-only View out of the hierarchy and `measureInWindow` reports nothing.
  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  )
}
