import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import { tokens, useReducedMotion } from '@cosimosi/ui'
import { StarPreview } from '@cosimosi/universe-render'

import { EpisodicMemoryMeta } from '../../../entities/episodic-memory/index.ts'
import { NeuronMeta } from '../../../entities/neuron/index.ts'

// The selected star's meta (RN fork): an episodic (big) star shows its preview and its readings, a
// neuron (small) star its facts only. The switch and the preview are the panel's; each noun's
// readings are its entity's.
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
    // The star above, what is known about it below — the same stack the web fork uses: side by side
    // the star is a thumbnail beside a table, stacked it is the subject and the rows are its caption.
    <View style={styles.episodic}>
      {/* The clipped frame holds the star; the action rides a wrapper OUTSIDE it, because a control
          inside the clip would be cut off at the corner it sits in. */}
      <View style={styles.previewFrame}>
        <View style={styles.preview}>
          <StarPreview
            memory={memory}
            universeTime={universeTime}
            shape={shape}
            reducedMotion={reducedMotion}
          />
        </View>
        {previewAction ? <View style={styles.previewAction}>{previewAction}</View> : null}
      </View>
      <EpisodicMemoryMeta memory={memory} universeTime={universeTime} />
    </View>
  )
}

const styles = StyleSheet.create({
  episodic: { gap: tokens.spacing[4] },
  previewFrame: { position: 'relative' },
  previewAction: { position: 'absolute', top: tokens.spacing[2], right: tokens.spacing[2] },
  // Rounded and clipped so the sky the star sits in reads as a window, not a hole.
  preview: {
    height: tokens.spacing[8] * 7,
    overflow: 'hidden',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
})
