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
  // The bottom band sits in the viewport above the home indicator, so the check that sends the line
  // to the top asks about the band where it will actually be drawn.
  const placed = resolveCaptionPosition({
    slot: { kind: 'edge' },
    anchorRect,
    viewport: { ...viewport, height: viewport.height - insets.bottom },
    bandHeight: CAPTION_BAND_HEIGHT,
  })
  // Both rooms are measured from the overlay's own edges, which on a notched phone sit under the
  // status bar and the home indicator. A top-band caption clears the same inset the skip does, so it
  // stays below the skip; a bottom-band caption clears the home indicator.
  const position =
    placed.from === 'top'
      ? { ...placed, insetPx: placed.insetPx + insets.top }
      : placed.from === 'bottom'
        ? { ...placed, insetPx: placed.insetPx + insets.bottom }
        : placed

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <SequenceSpotlight rect={anchorRect} />
      {caption ? <SequenceCaption caption={caption} position={position} /> : null}
      <SequenceSkip progress={progress} onSkip={onSkip} />
    </View>
  )
}
