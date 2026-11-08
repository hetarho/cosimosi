import type { CSSProperties, Ref } from 'react'
import { motion } from 'motion/react'

import type { CaptionPosition, SequenceCaption as CaptionAccessor } from '@cosimosi/sequence'
import { cx, useReducedMotion } from '@cosimosi/ui'

/** The reading height the placement resolver budgets for this line — what it reserves when it works
 *  out whether the band fits above a sheet or clear of a control. The band itself hugs its content. */
export const CAPTION_BAND_HEIGHT = 112

// widgets/sequence-guide ui ([O2]): one line of guidance. It is the guaranteed channel of the
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
  rightInset = 0,
  measureRef,
  ready = true,
}: {
  caption: CaptionAccessor
  position: CaptionPosition
  rightInset?: number
  measureRef?: Ref<HTMLParagraphElement>
  ready?: boolean
}) {
  const reducedMotion = useReducedMotion()
  const text = caption()
  return (
    // The live region stays exposed and still: it never hides and never moves, so a new line is
    // announced as it changes in place. `z-guide` sits above `z-modal`: the steps that point INTO
    // the writing dialog would otherwise put the line behind the very panel it describes.
    <div
      aria-live="polite"
      data-sequence-chrome=""
      className="pointer-events-none fixed top-0 left-0 z-[var(--z-guide)]"
    >
      {/* The band hides until its measured place commits, so it is never painted at the fallback
          and the layout never reports it moving into position. */}
      <div
        data-sequence-caption-band=""
        className={cx(
          'fixed inset-x-0 flex justify-center px-6',
          position.from === 'midline' && '-translate-y-1/2',
        )}
        style={{
          ...bandStyle(position),
          right: rightInset,
          visibility: ready ? 'visible' : 'hidden',
        }}
      >
        {/* `text-base` rather than `sm`: this line is the run's one guaranteed channel, and it has
            to carry from the middle of a page whose everything-else is deliberately dimmed. Short
            display copy, so Korean breaks between words and the lines balance (UI-6). */}
        <motion.p
          ref={measureRef}
          key={text}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="max-w-lg rounded-lg border border-primary/20 bg-surface-raised/90 px-5 py-3.5 text-center text-base leading-relaxed break-keep wrap-break-word text-balance text-text shadow-lg"
        >
          {text}
        </motion.p>
      </div>
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
