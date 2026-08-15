import { useEffect } from 'react'

import {
  resolveCaptionPlacement,
  resolveCenteredCaptionPlacement,
  type SequenceCaption as CaptionAccessor,
  type SequenceProgress,
  type SequenceRect,
} from '@cosimosi/sequence'
import { SHEET_BREAKPOINT } from '@cosimosi/ui'

import { SequenceSpotlight } from '../../../features/highlight-next-control/index.ts'
import {
  CAPTION_BAND_HEIGHT_PX,
  SequenceCaption,
} from '../../../features/show-sequence-caption/index.ts'
import { SequenceSkip } from '../../../features/skip-sequence/index.ts'
import { useViewport } from '../lib/use-viewport.ts'

export interface SequenceGuideProps {
  readonly active: boolean
  readonly caption: CaptionAccessor | null
  readonly anchorRect: SequenceRect | null
  readonly progress: SequenceProgress
  readonly onSkip: () => void
  /** The engine's `remeasure`; called when the window size changes under the highlight. */
  readonly onRemeasure: () => void
  /** How the caption should sit on a NARROW screen, where the host's surfaces own the bottom edge:
   *  `center` floats it just above the middle (yielding to the edges when the anchored control
   *  crosses that band); `top` pins it to the top band (for a host surface that owns the middle AND
   *  the bottom, like a bottom sheet); `attached` glues it right under the highlighted control —
   *  over it when the bottom edge is too close — for steps staged inside a panel; the default keeps
   *  the edge-band resolution. From `md` up every style collapses to the edge resolution, because a
   *  wide screen's interrupting surfaces are centred and the bottom band is free. */
  readonly captionStyle?: 'edge' | 'center' | 'top' | 'attached'
}

/** The shared sheet breakpoint converted once from its generated rem source. */
const WIDE_MIN_WIDTH_PX = SHEET_BREAKPOINT.px

// widgets/sequence-guide ui: composes the three chrome features over whatever screen is beneath and
// mounts nothing of its own. The host owns the actor and the outcome and passes a derived view down,
// so this widget holds no run state — which is what lets one guide serve a public sandbox and a live
// signed-in session without knowing which it is over.
//
// It owns exactly one platform concern: the window size. The engine is platform-neutral and cannot
// subscribe to a resize, so the chrome that re-renders on one tells it to measure again.
export function SequenceGuide({
  active,
  caption,
  anchorRect,
  progress,
  onSkip,
  onRemeasure,
  captionStyle = 'edge',
}: SequenceGuideProps) {
  const viewport = useViewport()

  useEffect(() => {
    if (active) onRemeasure()
  }, [active, onRemeasure, viewport])

  if (!active) return null

  // The one breakpoint the chrome reads, and it is the same one `Dialog` reads: at `md` an
  // interrupting surface stops being a bottom sheet and becomes a CENTRED modal, which frees the
  // bottom edge and occupies the middle. So on a wide screen every host style collapses to the edge
  // resolution — the line goes to the bottom band it can own outright, instead of over the panel it
  // is describing — and only a narrow screen keeps the host's own choice, where the bottom belongs
  // to the sheet and the guidance has to float above it.
  const wide = viewport.width >= WIDE_MIN_WIDTH_PX

  const placement =
    !wide && captionStyle === 'top'
      ? 'top'
      : !wide && captionStyle === 'center'
        ? resolveCenteredCaptionPlacement(anchorRect, viewport, CAPTION_BAND_HEIGHT_PX)
        : resolveCaptionPlacement(anchorRect, viewport, CAPTION_BAND_HEIGHT_PX)

  // Attached mode pins the line to the highlighted control itself: below it, or above it when the
  // band would run off the bottom edge. `bottom`-pinning for the above case needs no guess at the
  // bubble's real height. Without a measured control it falls back to the band resolution — as does
  // every wide screen, where the bottom band is the better answer than gluing the line into a
  // centred modal's own body.
  const ATTACH_GAP_PX = 12
  const pin =
    !wide && captionStyle === 'attached' && anchorRect
      ? anchorRect.y + anchorRect.height + ATTACH_GAP_PX + CAPTION_BAND_HEIGHT_PX <= viewport.height
        ? { top: anchorRect.y + anchorRect.height + ATTACH_GAP_PX }
        : { bottom: viewport.height - anchorRect.y + ATTACH_GAP_PX }
      : null

  return (
    <>
      <SequenceSpotlight rect={anchorRect} />
      {caption ? <SequenceCaption caption={caption} placement={placement} pin={pin} /> : null}
      <SequenceSkip progress={progress} onSkip={onSkip} />
    </>
  )
}
