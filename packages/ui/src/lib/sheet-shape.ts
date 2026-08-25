import { SHEET_BREAKPOINT } from './sheet-geometry.ts'

/**
 * The width below which a surface with two shapes wears the bottom-sheet one — the `md:` switch in
 * `dialog.tsx` and `sheet.tsx`, read from script. A gesture only makes sense on the shape that has a
 * bottom edge to go out through, and reading the media query here is what keeps a wide-screen
 * pointer from dragging a panel that has nowhere to go. The geometry chain test pins the remaining
 * CSS/Tailwind anchors to the generated breakpoint.
 */
export const SHEET_VIEWPORT = `(width < ${SHEET_BREAKPOINT.rem}rem)`

/**
 * Whether the sheet shape is the one on screen right now.
 *
 * Read at press time rather than subscribed to: the shape only matters while a gesture is being
 * decided, so a value one frame stale during a resize costs nothing and a render does.
 */
export function isSheetShape(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.(SHEET_VIEWPORT)?.matches === true
}

/**
 * Stamped on the PANEL of every surface that takes a screen edge — `Dialog`'s sheet shape and
 * `Sheet`'s both wear it.
 *
 * It exists for chrome that paints ABOVE the modal layer and therefore has to keep off what is
 * under it: a guided run's caption, which must never lie across the surface it is describing. Such
 * chrome measures the marked panels rather than being told about each one, which is what lets it
 * clear a panel it has never heard of — and the marker is an attribute rather than an export
 * because the reader is in another package and the panel is in a portal.
 */
export const SURFACE_PANEL_ATTR = 'data-cosimosi-surface'

/** A drag that starts on a control is that control's press, not the sheet's. */
const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [role="slider"]'

export function startsOnControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}
