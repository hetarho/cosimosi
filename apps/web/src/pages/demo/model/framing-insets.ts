import { CAPTION_EYELINE, CAPTION_SURFACE_GAP_PX, type CaptionSlotKind } from '@cosimosi/sequence'

export interface CaptionRoomInputs {
  /** A tutorial caption is on this beat, even while a scene moment holds it back. */
  readonly captionShowing: boolean
  /** Narrower than the sheet breakpoint, where an interrupting surface is a bottom sheet. */
  readonly narrow: boolean
  /** A marked panel owns the bottom edge. */
  readonly bottomSurface: boolean
}

/**
 * The room the guide gives its caption when the host names none (ONB-12), read rather than named:
 * above a bottom surface, the bottom band on a wide screen, the eyeline on a phone. `null` while no
 * caption shows.
 */
export function guideCaptionRoom({
  captionShowing,
  narrow,
  bottomSurface,
}: CaptionRoomInputs): CaptionSlotKind | null {
  if (!captionShowing) return null
  if (bottomSurface) return 'aboveSurface'
  return narrow ? 'eyeline' : 'edge'
}

export interface FramingTopInputs {
  /** The overview's top inset with nothing to clear. */
  readonly top: number
  readonly viewportHeight: number
  readonly captionRoom: CaptionSlotKind | null
  /** The caption band's rendered height; 0 until it has been measured. */
  readonly captionBandHeight: number
}

/**
 * The overview framing's top inset. A caption in the eyeline sits centred just above the middle of a
 * phone, exactly where the overview would put the memories it describes, so the frame starts one gap
 * below the band's lower edge. Every other room leaves the inset as it is: the bottom band and the
 * room above a surface are already outside the frame.
 */
export function framingTopInset({
  top,
  viewportHeight,
  captionRoom,
  captionBandHeight,
}: FramingTopInputs): number {
  if (captionRoom !== 'eyeline' || captionBandHeight <= 0) return top
  const bandBottom = viewportHeight * CAPTION_EYELINE + captionBandHeight / 2
  return Math.max(top, Math.ceil(bandBottom + CAPTION_SURFACE_GAP_PX))
}
