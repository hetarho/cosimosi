import { VALUES } from '@cosimosi/config'

// CSS media-query rem units resolve against the initial 16px font size. Keeping the conversion next
// to the generated rem value makes the script-facing px threshold a derivation, never a second knob.
const CSS_PX_PER_REM = 16

/** The one responsive-sheet breakpoint consumed by media-query and pixel-based script callers. */
export const SHEET_BREAKPOINT = Object.freeze({
  rem: VALUES.ui.sheetBreakpointRem,
  px: VALUES.ui.sheetBreakpointRem * CSS_PX_PER_REM,
})

/** Generated interaction geometry shared by the two web sheet gesture implementations. */
export const SHEET_GESTURE = Object.freeze({
  dialogDismissPx: VALUES.ui.sheetDialogDismissPx,
  resizeDismissPx: VALUES.ui.sheetResizeDismissPx,
  flickPx: VALUES.ui.sheetFlickPx,
  flickVelocityPxPerMs: VALUES.ui.sheetFlickVelocityPxPerMs,
  settleMs: VALUES.ui.sheetSettleMs,
  tallestViewportRatio: VALUES.ui.sheetTallestViewportRatio,
  shortestViewportRatio: VALUES.ui.sheetShortestViewportRatio,
  tapPx: VALUES.ui.sheetTapPx,
})
