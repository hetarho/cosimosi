import type { CSSProperties } from 'react'

import type { CaptionPosition, SequenceCaption as CaptionAccessor } from '@cosimosi/sequence'
import { cx } from '@cosimosi/ui'

/** The reading height the placement resolver budgets for this line — what it reserves when it works
 *  out whether the band fits above a sheet or clear of a control. The band itself hugs its content. */
export const CAPTION_BAND_HEIGHT_PX = 112

// features/show-sequence-caption ui ([O2]): one line of guidance. It is the guaranteed channel of the
// whole engine — the highlight can fail to resolve, the caption cannot — which is why it lives in a
// POLITE live region: a step change is announced to a screen reader without stealing the reader's
// place, and the run stays followable with no highlight at all.
//
// WHERE the line goes is not decided here. The resolver hands down one `CaptionPosition`, and this
// file's only job is to render it, so the band that yields and the band that paints cannot drift
// apart — the numbers are the resolver's, applied as styles rather than restated as classes.
//
// The accessor is called at render time rather than resolved once, so a locale switch mid-run
// re-renders this line through the app's existing locale provider.
export function SequenceCaption({
  caption,
  position,
}: {
  caption: CaptionAccessor
  position: CaptionPosition
}) {
  return (
    <div
      aria-live="polite"
      className={cx(
        // `z-guide` sits above `z-modal`: the steps that point INTO the writing dialog would otherwise
        // put the line behind the very panel it describes.
        'pointer-events-none fixed inset-x-0 z-[var(--z-guide)] flex justify-center px-6',
        position.from === 'midline' && '-translate-y-1/2',
      )}
      style={bandStyle(position)}
    >
      {/* `text-base` rather than `sm`: this line is the run's one guaranteed channel, and it has to
          carry from the middle of a page whose everything-else is deliberately dimmed. */}
      <p className="max-w-lg rounded-lg bg-surface-raised/90 px-5 py-3.5 text-center text-base text-text">
        {caption()}
      </p>
    </div>
  )
}

function bandStyle(position: CaptionPosition): CSSProperties {
  switch (position.from) {
    case 'top':
      return { top: position.insetPx }
    case 'bottom':
      return { bottom: position.insetPx }
    case 'midline':
      return { top: `${position.fraction * 100}%` }
  }
}
