import { describe, expect, it } from 'vitest'

import {
  CAPTION_EDGE_INSET_PX,
  CAPTION_EYELINE,
  CAPTION_SURFACE_GAP_PX,
  CAPTION_TOP_INSET_PX,
  resolveCaptionPosition,
  clearCaptionObstacles,
  type CaptionSlot,
} from './caption-placement.ts'
import type { SequenceRect } from './select.ts'

const VIEWPORT = { width: 400, height: 800 }
const BAND = 96

describe('measured caption clearance', () => {
  it('rechecks the split action after a footer has lifted a long caption', () => {
    const position = clearCaptionObstacles({
      preferred: { from: 'bottom', insetPx: 122 },
      viewport: { width: 768, height: 663 },
      caption: { x: 128, width: 512, height: 106 },
      obstacles: [
        { x: 446, y: 316, width: 154, height: 58 },
        { x: 318, y: 457, width: 150, height: 48 },
      ],
    })
    expect(position).toEqual({ from: 'top', insetPx: 517 })
  })

  it('uses the rendered height when a translated paragraph wraps to many lines', () => {
    expect(
      clearCaptionObstacles({
        preferred: { from: 'bottom', insetPx: 32 },
        viewport: VIEWPORT,
        caption: { x: 24, width: 352, height: 192 },
        obstacles: [{ x: 20, y: 500, width: 360, height: 300 }],
      }),
    ).toEqual({ from: 'top', insetPx: 296 })
  })

  it('leaves a caption beside a side panel and inside a reserved modal header band', () => {
    const preferred = { from: 'top', insetPx: 64 } as const
    expect(
      clearCaptionObstacles({
        preferred,
        viewport: { width: 1024, height: 768 },
        caption: { x: 80, width: 512, height: 100 },
        obstacles: [
          { x: 672, y: 0, width: 352, height: 768 },
          { x: 100, y: 176, width: 500, height: 592 },
        ],
      }),
    ).toEqual(preferred)
  })
})

const at = (slot: CaptionSlot, anchorRect: SequenceRect | null = null) =>
  resolveCaptionPosition({ slot, anchorRect, viewport: VIEWPORT, bandHeight: BAND })

describe('the edge slot', () => {
  it('takes the bottom band, and the top one only when the highlighted control owns the bottom', () => {
    expect(at({ kind: 'edge' })).toEqual({ from: 'bottom', insetPx: CAPTION_EDGE_INSET_PX })
    // A control up the page: the line stays where the reader expects it.
    expect(at({ kind: 'edge' }, { x: 0, y: 100, width: 200, height: 40 })).toEqual({
      from: 'bottom',
      insetPx: CAPTION_EDGE_INSET_PX,
    })
    // A control in the bottom band — exactly the collision the rule exists for.
    expect(at({ kind: 'edge' }, { x: 0, y: 720, width: 400, height: 80 })).toEqual({
      from: 'top',
      // Further in than the bottom band: the run's always-visible skip owns the top-right corner.
      insetPx: CAPTION_TOP_INSET_PX,
    })
    expect(CAPTION_TOP_INSET_PX).toBeGreaterThan(CAPTION_EDGE_INSET_PX)
  })

  it('reads a control below the viewport as nothing to get off', () => {
    // A rect entirely off the bottom is a control that has scrolled or animated away, not one the
    // line is sitting on.
    expect(at({ kind: 'edge' }, { x: 0, y: 900, width: 10, height: 10 })).toEqual({
      from: 'bottom',
      insetPx: CAPTION_EDGE_INSET_PX,
    })
  })
})

describe('the eyeline slot', () => {
  it('floats just above the middle', () => {
    // ABOVE the middle, so the bottom half — where a narrow screen's sheets come up from — is never
    // where the line lands.
    expect(CAPTION_EYELINE).toBeLessThan(0.5)
    expect(at({ kind: 'eyeline' })).toEqual({ from: 'midline', fraction: CAPTION_EYELINE })
    // A control along the top edge, and one sitting where a bottom sheet does, both leave the
    // floating band free.
    expect(at({ kind: 'eyeline' }, { x: 0, y: 40, width: 200, height: 40 })).toEqual({
      from: 'midline',
      fraction: CAPTION_EYELINE,
    })
    expect(at({ kind: 'eyeline' }, { x: 0, y: 560, width: 400, height: 240 })).toEqual({
      from: 'midline',
      fraction: CAPTION_EYELINE,
    })
  })

  it('yields to the edge rather than sitting on a control that crosses it', () => {
    expect(at({ kind: 'eyeline' }, { x: 200, y: 300, width: 400, height: 200 })).toEqual({
      from: 'bottom',
      insetPx: CAPTION_EDGE_INSET_PX,
    })
    // A mid-crossing control that ALSO owns the bottom band pushes the line to the top.
    expect(at({ kind: 'eyeline' }, { x: 200, y: 300, width: 400, height: 450 })).toEqual({
      from: 'top',
      insetPx: CAPTION_TOP_INSET_PX,
    })
  })
})

describe('the aboveSurface slot', () => {
  it('clears the surface by one gap, whatever height the surface is', () => {
    // Two sheets of different heights get the same gap above their own top edge — which is what
    // makes this one rule rather than a band hardcoded per panel.
    for (const top of [500, 300]) {
      expect(
        at({ kind: 'aboveSurface', surface: { x: 0, y: top, width: 400, height: 800 - top } }),
      ).toEqual({ from: 'bottom', insetPx: VIEWPORT.height - top + CAPTION_SURFACE_GAP_PX })
    }
  })

  it('clamps against the top edge instead of pushing the line off the screen', () => {
    // A sheet taller than the room above it: the line goes as high as it can and stops, rather than
    // sliding out of the viewport where nothing would be readable at all.
    const position = at({ kind: 'aboveSurface', surface: { x: 0, y: 20, width: 400, height: 780 } })
    expect(position).toEqual({
      from: 'bottom',
      insetPx: VIEWPORT.height - BAND - CAPTION_TOP_INSET_PX,
    })
  })

  it('falls back to the edge for a surface that is not on screen', () => {
    // Mid-arrival and mid-leave both put the panel below the bottom edge; pinning to it would put
    // the line off the page.
    expect(
      at({ kind: 'aboveSurface', surface: { x: 0, y: 800, width: 400, height: 400 } }),
    ).toEqual({ from: 'bottom', insetPx: CAPTION_EDGE_INSET_PX })
  })

  it('never lets the surface pull the line in tighter than the plain edge band', () => {
    // A panel whose top edge is at the very bottom of the screen has no room to clear; the line
    // reads at its normal edge inset instead of jammed against the bottom.
    expect(at({ kind: 'aboveSurface', surface: { x: 0, y: 799, width: 400, height: 1 } })).toEqual({
      from: 'bottom',
      insetPx: CAPTION_EDGE_INSET_PX,
    })
  })
})
