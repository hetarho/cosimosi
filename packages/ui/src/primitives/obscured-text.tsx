import { cx } from '../lib/cx.ts'
import type { ObscuredTextProps } from './types.ts'

/**
 * A passage some of which has stopped being legible.
 *
 * The runs arrive already decided — this draws them, and nothing more. A legible run is plain text;
 * an obscured one is the same characters under a blur strong enough that no shape survives it, which
 * is what makes the loss something the reader SEES rather than something a label tells them.
 *
 * The obscured runs stay in the accessibility tree, carrying whatever marker the caller passed. A
 * reader listening to the passage hears the loss where a reader looking at it sees it; hiding them
 * would hand assistive tech a shorter, tidier sentence than the one on screen.
 */
export function ObscuredText({ spans, className }: ObscuredTextProps) {
  return (
    <p className={cx('text-sm leading-relaxed whitespace-pre-wrap text-text', className)}>
      {spans.map((span, index) =>
        span.obscured ? (
          // Keyed by position because the runs are a rendering of one immutable string: the same
          // text always yields the same list, so an index is stable for as long as the passage is.
          <span key={index} className="obscured-run">
            {span.text}
          </span>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </p>
  )
}
