import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  resolveCaptionPosition,
  type SequenceCaption as CaptionAccessor,
  type SequenceProgress,
  type SequenceRect,
} from '@cosimosi/sequence'

import { SequenceSpotlight } from './SequenceSpotlight.tsx'
import { CAPTION_BAND_HEIGHT, SequenceCaption } from './SequenceCaption.tsx'
import { SequenceSkip } from '../../../features/skip-sequence/index.ts'
import { useScreenInsets } from '../../../shared/native/index.ts'
import { useViewport } from '../lib/use-viewport.ts'

export interface SequenceGuideProps {
  readonly active: boolean
  readonly caption: CaptionAccessor | null
  readonly anchorRect: SequenceRect | null
  readonly progress: SequenceProgress
  readonly onSkip: () => void
  /** The engine's `remeasure`; called when the window size changes under the highlight. */
  readonly onRemeasure: () => void
}

// widgets/sequence-guide ui (RN fork): composes the three chrome features over whatever screen is
// beneath and mounts nothing of its own. The host owns the actor and the outcome and passes a derived
// view down, so this widget holds no run state.
//
// The outer overlay is `pointerEvents="box-none"`, which is the native form of the non-modal promise:
// touches pass straight through to the screen underneath, and only the skip control receives them.
export function SequenceGuide({
  active,
  caption,
  anchorRect,
  progress,
  onSkip,
  onRemeasure,
}: SequenceGuideProps) {
  const viewport = useViewport()
  const insets = useScreenInsets()

  useEffect(() => {
    if (active) onRemeasure()
  }, [active, onRemeasure, viewport])

  if (!active) return null

  // The edge slot: a native screen's surfaces are not marked panels this fork can measure, so the
  // line takes the free edge and gets off the highlighted control when that control owns the bottom.
  const placed = resolveCaptionPosition({
    slot: { kind: 'edge' },
    anchorRect,
    viewport,
    bandHeight: CAPTION_BAND_HEIGHT,
  })
  // The top room is measured from the overlay's own top, which on a notched phone is under the status
  // bar; it clears the same inset the skip does, so a top-band caption stays below the skip.
  const position =
    placed.from === 'top' ? { ...placed, insetPx: placed.insetPx + insets.top } : placed

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <SequenceSpotlight rect={anchorRect} />
      {caption ? <SequenceCaption caption={caption} position={position} /> : null}
      <SequenceSkip progress={progress} onSkip={onSkip} />
    </View>
  )
}
