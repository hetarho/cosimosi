import type { ReactNode } from 'react'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import { useReducedMotion } from '@cosimosi/ui'
import { StarPreview } from '@cosimosi/universe-render'

import { EpisodicMemoryMeta } from '../../../entities/episodic-memory/index.ts'
import { NeuronMeta } from '../../../entities/neuron/index.ts'

// The selected star's meta: an episodic (big) star shows its preview and its readings, a neuron
// (small) star its facts only. The switch and the preview are the panel's; each noun's readings are
// its entity's.
export function StarMeta({
  selection,
  universeTime,
  shape,
  previewAction,
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // The read-time "now" that drives the forgetting fade + current decay stage [V2][F1].
  universeTime: string | null
  /** The `STAR_SHADER` ornament this universe wears, so the panel's star is the one in the sky. */
  shape?: string
  /** A corner of the preview frame the panel may put a control in. */
  previewAction?: ReactNode
}) {
  // Read above the neuron branch, because a hook cannot sit behind an early return. A neuron shows
  // no star, so it simply goes unused there.
  const reducedMotion = useReducedMotion()

  if (selection.kind === 'neuron') return <NeuronMeta neuron={selection.neuron} />

  const { memory } = selection
  return (
    // The star above, what is known about it below. Side by side, the star is a thumbnail beside a
    // table; stacked, it is the subject and the rows are its caption — and the rows get the panel's
    // full width instead of splitting it with a picture.
    <div className="memory-meta-reading flex flex-col gap-6">
      {/* Rounded and clipped so the sky the star sits in reads as a window, not a hole. The frame is
          `aria-hidden` and clips, so the action rides a positioned wrapper OUTSIDE it: a focusable
          control inside a hidden subtree is unreachable, and one inside the clip is cut off. */}
      <div className="relative">
        <div aria-hidden className="h-44 w-full overflow-hidden rounded-xl border border-border">
          <StarPreview
            memory={memory}
            universeTime={universeTime}
            shape={shape}
            reducedMotion={reducedMotion}
          />
        </div>
        {previewAction ? <div className="absolute top-2 right-2">{previewAction}</div> : null}
      </div>
      <EpisodicMemoryMeta memory={memory} universeTime={universeTime} />
    </div>
  )
}
