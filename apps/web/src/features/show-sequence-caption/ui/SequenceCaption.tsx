import type { CaptionPlacement, SequenceCaption as CaptionAccessor } from '@cosimosi/sequence'
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
}: {
  caption: CaptionAccessor
  placement: CaptionPlacement
}) {
  return (
    <div
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-6',
        placement === 'top' ? 'top-0 pt-8' : 'bottom-0 pb-8',
      )}
      style={{ minHeight: CAPTION_BAND_HEIGHT_PX }}
    >
      <p className="max-w-md rounded-lg bg-surface-raised/90 px-4 py-3 text-center text-sm text-text">
        {caption()}
      </p>
    </div>
  )
}
