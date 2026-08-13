import {
  CENTERED_CAPTION_MIDLINE,
  type CaptionPlacement,
  type SequenceCaption as CaptionAccessor,
} from '@cosimosi/sequence'
import { cx } from '@cosimosi/ui'

export const CAPTION_BAND_HEIGHT_PX = 112

// features/show-sequence-caption ui ([O2]): one line of guidance, bottom center. It is the guaranteed
// channel of the whole engine — the highlight can fail to resolve, the caption cannot — which is why
// it lives in a POLITE live region: a step change is announced to a screen reader without stealing
// the reader's place, and the run stays followable with no highlight at all.
//
// The accessor is called at render time rather than resolved once, so a locale switch mid-run
// re-renders this line through the app's existing locale provider.
export function SequenceCaption({
  caption,
  placement,
  pin,
}: {
  caption: CaptionAccessor
  placement: CaptionPlacement
  /** Pixel-pinned position (host-computed, e.g. right under the highlighted control). When given
   *  it wins over the band classes; exactly one of `top`/`bottom` is set. */
  pin?: { readonly top?: number; readonly bottom?: number } | null
}) {
  return (
    <div
      aria-live="polite"
      className={cx(
        // `z-guide` sits above `z-modal`: the steps that point INTO the writing dialog would otherwise
        // put the line behind the very panel it describes.
        'pointer-events-none fixed inset-x-0 z-[var(--z-guide)] flex justify-center px-6',
        // `center` is host-opted (a placement resolver yields it only when asked) and floats the
        // line just ABOVE the middle — in the eyeline, and clear of the bottom edge every
        // interrupting surface on a narrow screen comes up from. Its exact midline is the
        // resolver's own `CENTERED_CAPTION_MIDLINE`, applied as a style below rather than as a class
        // so the yielding band and the rendered band cannot drift apart.
        !pin && placement === 'top' && 'top-0 pt-8',
        !pin && placement === 'bottom' && 'bottom-0 pb-8',
        !pin && placement === 'center' && '-translate-y-1/2 items-center',
      )}
      style={
        pin
          ? { top: pin.top, bottom: pin.bottom }
          : {
              minHeight: CAPTION_BAND_HEIGHT_PX,
              ...(placement === 'center'
                ? { top: `${CENTERED_CAPTION_MIDLINE * 100}%` }
                : undefined),
            }
      }
    >
      {/* `text-base` rather than `sm`: this line is the run's one guaranteed channel, and it has to
          carry from the middle of a page whose everything-else is deliberately dimmed. */}
      <p className="max-w-lg rounded-lg bg-surface-raised/90 px-5 py-3.5 text-center text-base text-text">
        {caption()}
      </p>
    </div>
  )
}
