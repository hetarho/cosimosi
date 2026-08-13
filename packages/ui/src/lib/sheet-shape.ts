/**
 * The width below which a surface with two shapes wears the bottom-sheet one — the `md:` switch in
 * `dialog.tsx` and `sheet.tsx`, read from script. Keep the three in step: a gesture only makes sense
 * on the shape that has a bottom edge to go out through, and reading the media query here is what
 * keeps a wide-screen pointer from dragging a panel that has nowhere to go.
 */
export const SHEET_VIEWPORT = '(width < 48rem)'

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

/** A drag that starts on a control is that control's press, not the sheet's. */
const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [role="slider"]'

export function startsOnControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}
