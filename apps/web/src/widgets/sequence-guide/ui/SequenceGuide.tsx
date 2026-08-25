import { useEffect } from 'react'

import {
  resolveCaptionPosition,
  type CaptionSlot,
  type CaptionSlotKind,
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
import { useBottomSurface } from '../lib/use-bottom-surface.ts'
import { useViewport } from '../lib/use-viewport.ts'

export interface SequenceGuideProps {
  readonly active: boolean
  readonly caption: CaptionAccessor | null
  readonly anchorRect: SequenceRect | null
  readonly progress: SequenceProgress
  readonly onSkip: () => void
  /** The engine's `remeasure`; called when the window size changes under the highlight. */
  readonly onRemeasure: () => void
  /**
   * Overrides where the caption sits. Leave it out: the default reads the screen — a bottom sheet on
   * it puts the line just above that sheet, and a clear screen puts the line in the eyeline on a
   * phone and in the bottom band on a wide one, whose interrupting surfaces are centred.
   *
   * It exists for the one thing the default cannot see: a host whose surface is not a marked panel,
   * and which therefore has to name the room itself. `aboveSurface` with nothing measured falls back
   * to the edge band rather than pinning the line to a surface that is not there.
   */
  readonly captionSlot?: CaptionSlotKind
}

/** The shared sheet breakpoint converted once from its generated rem source. */
const WIDE_MIN_WIDTH_PX = SHEET_BREAKPOINT.px

// widgets/sequence-guide ui: composes the three chrome features over whatever screen is beneath and
// mounts nothing of its own. The host owns the actor and the outcome and passes a derived view down,
// so this widget holds no run state — which is what lets one guide serve a public sandbox and a live
// signed-in session without knowing which it is over.
//
// It owns exactly two platform concerns, and both are the same concern in the end: where the free
// room on this screen is. The window size, because the engine is platform-neutral and cannot
// subscribe to a resize; and the surfaces currently taking the bottom edge, because guidance must
// never lie across the panel it is describing. Neither is a host's business to spell out, which is
// why no page here carries a band per sheet.
export function SequenceGuide({
  active,
  caption,
  anchorRect,
  progress,
  onSkip,
  onRemeasure,
  captionSlot,
}: SequenceGuideProps) {
  const viewport = useViewport()
  const surface = useBottomSurface(active, viewport)

  useEffect(() => {
    if (active) onRemeasure()
  }, [active, onRemeasure, viewport])

  if (!active) return null

  // The one breakpoint the chrome reads, and it is the same one `Dialog` reads: at `md` an
  // interrupting surface stops being a bottom sheet and becomes a CENTRED modal, which frees the
  // bottom edge and occupies the middle. So on a wide screen with nothing in the way the line takes
  // the bottom band rather than floating into the space a modal will want.
  const wide = viewport.width >= WIDE_MIN_WIDTH_PX
  const slot = captionRoom(
    captionSlot ?? (surface ? 'aboveSurface' : wide ? 'edge' : 'eyeline'),
    surface,
  )
  const position = resolveCaptionPosition({
    slot,
    anchorRect,
    viewport,
    bandHeight: CAPTION_BAND_HEIGHT_PX,
  })

  return (
    <>
      <SequenceSpotlight rect={anchorRect} />
      {caption ? <SequenceCaption caption={caption} position={position} /> : null}
      <SequenceSkip progress={progress} onSkip={onSkip} />
    </>
  )
}

// The measured surface joins the named kind here, so a host (or the default above) can say
// `aboveSurface` without holding a rect — and asking for it with nothing on screen is answered by
// the edge band rather than by a pin to a panel that is not there.
function captionRoom(kind: CaptionSlotKind, surface: SequenceRect | null): CaptionSlot {
  if (kind !== 'aboveSurface') return { kind }
  return surface ? { kind, surface } : { kind: 'edge' }
}
