import type { SequenceRect, SequenceViewport } from './select.ts'

// Where the run's one caption goes — a named decision, not a pixel a host picked.
//
// The whole family exists to hold one rule: guidance never sits on what it is describing. A host
// says which KIND of room the screen has right now; this file turns that into one position. The
// split is what keeps every interrupting surface on a single rule — a sheet arrives as a measured
// rect, so no page spells out a band per panel, and a panel a page has never heard of clears by the
// same gap as the ones it has.

/**
 * The room the caption is being given.
 *
 * Three kinds, and a host chooses by what is on screen rather than by which surface it is: that is
 * the difference between one rule and one hardcoded band per sheet.
 */
export type CaptionSlot =
  /** The free screen edge — the bottom band, or the top one when the highlighted control owns the
   *  bottom. What a wide screen always has, because its interrupting surfaces are centred and leave
   *  both edges alone. */
  | { readonly kind: 'edge' }
  /** The reader's eyeline, just above the middle: for a clear canvas with nothing interrupting. It
   *  yields to `edge` when the highlighted control crosses that band. */
  | { readonly kind: 'eyeline' }
  /** The room left above a surface that owns the bottom edge, measured from that surface's OWN top
   *  edge — so a sheet of any height, dragged to any size, is cleared by the same gap. */
  | { readonly kind: 'aboveSurface'; readonly surface: SequenceRect }

/** The slot kinds, for a host that names one without holding a rect (the resolver fills it in). */
export type CaptionSlotKind = CaptionSlot['kind']

/**
 * The resolved position, in the one shape both platform renderers consume: which side of the
 * viewport the band is measured from, and how far in.
 *
 * `midline` is the single non-edge case and carries a FRACTION rather than a pixel, so the line
 * recentres on a resize instead of holding a number that was right on one screen.
 */
export type CaptionPosition =
  | { readonly from: 'top'; readonly insetPx: number }
  | { readonly from: 'bottom'; readonly insetPx: number }
  | { readonly from: 'midline'; readonly fraction: number }

/** How far in from the BOTTOM edge the band sits — its breathing room against the edge. */
export const CAPTION_EDGE_INSET_PX = 32

/**
 * How far in from the TOP edge it sits, which is further, because that edge is not free: a run keeps
 * its skip affordance pinned to the top-right on every step, and a wide caption centred on a narrow
 * screen reaches under it. The top band is where the line ends up when the bottom is taken, so this
 * is also the ceiling every other placement clamps against.
 */
export const CAPTION_TOP_INSET_PX = 64

/** The gap between the band and a surface it is clearing: enough to read as a separate thing
 *  hovering over the sheet, little enough that it still reads as being about it. */
export const CAPTION_SURFACE_GAP_PX = 12

/**
 * Where the eyeline is, as a fraction of the viewport height. Just ABOVE the middle: the surfaces
 * that interrupt on a narrow screen come up from the bottom edge, so the free room is the upper
 * half — while the eyeline is still the middle, not the top edge.
 */
export const CAPTION_EYELINE = 0.42

export interface CaptionRoom {
  readonly slot: CaptionSlot
  /** The highlighted control, so the band can get off the thing it is describing. */
  readonly anchorRect: SequenceRect | null
  readonly viewport: SequenceViewport
  /** How tall the rendered line reads at most. A clamp budget, not a rendered box: the band hugs its
   *  own content, and this is what the resolver reserves when it decides whether a line fits. */
  readonly bandHeight: number
}

export function resolveCaptionPosition(room: CaptionRoom): CaptionPosition {
  switch (room.slot.kind) {
    case 'aboveSurface':
      return aboveSurface(room, room.slot.surface)
    case 'eyeline':
      return eyeline(room)
    case 'edge':
      return edge(room)
  }
}

/**
 * Just above the surface's top edge. A surface taller than the room above it clamps the band against
 * the top edge rather than pushing it off the screen — the least-bad answer, and the same one a
 * full-height surface gets.
 */
function aboveSurface(room: CaptionRoom, surface: SequenceRect): CaptionPosition {
  const { viewport, bandHeight } = room
  // Below the bottom edge is not on screen — a surface mid-arrival or mid-leave has nothing to
  // clear, and pinning to it would put the line off the bottom of the page.
  if (surface.y >= viewport.height) return edge(room)
  const ceiling = Math.max(
    CAPTION_EDGE_INSET_PX,
    viewport.height - bandHeight - CAPTION_TOP_INSET_PX,
  )
  const wanted = viewport.height - surface.y + CAPTION_SURFACE_GAP_PX
  return { from: 'bottom', insetPx: clamp(wanted, CAPTION_EDGE_INSET_PX, ceiling) }
}

function eyeline(room: CaptionRoom): CaptionPosition {
  const { anchorRect, viewport, bandHeight } = room
  const floating: CaptionPosition = { from: 'midline', fraction: CAPTION_EYELINE }
  if (!anchorRect) return floating
  const bandTop = viewport.height * CAPTION_EYELINE - Math.max(0, bandHeight) / 2
  const bandBottom = bandTop + Math.max(0, bandHeight)
  return crosses(anchorRect, bandTop, bandBottom) ? edge(room) : floating
}

function edge(room: CaptionRoom): CaptionPosition {
  const { anchorRect, viewport, bandHeight } = room
  const bottomBand: CaptionPosition = { from: 'bottom', insetPx: CAPTION_EDGE_INSET_PX }
  if (!anchorRect) return bottomBand
  const bandTop = viewport.height - CAPTION_EDGE_INSET_PX - Math.max(0, bandHeight)
  return crosses(anchorRect, bandTop, viewport.height)
    ? { from: 'top', insetPx: CAPTION_TOP_INSET_PX }
    : bottomBand
}

function crosses(rect: SequenceRect, top: number, bottom: number): boolean {
  return rect.y + rect.height > top && rect.y < bottom
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}
