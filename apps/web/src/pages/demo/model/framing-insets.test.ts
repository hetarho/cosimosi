import { describe, expect, it } from 'vitest'

import { CAPTION_EYELINE, CAPTION_SURFACE_GAP_PX } from '@cosimosi/sequence'

import { framingTopInset, guideCaptionRoom } from './framing-insets.ts'

const TOP = 96
const PHONE_HEIGHT = 844
const BAND = 108

function topFor(room: ReturnType<typeof guideCaptionRoom>, bandHeight = BAND) {
  return framingTopInset({
    top: TOP,
    viewportHeight: PHONE_HEIGHT,
    captionRoom: room,
    captionBandHeight: bandHeight,
  })
}

describe('guideCaptionRoom', () => {
  it('reads the guide’s default room from the screen', () => {
    const showing = { captionShowing: true }
    expect(guideCaptionRoom({ ...showing, narrow: true, bottomSurface: false })).toBe('eyeline')
    expect(guideCaptionRoom({ ...showing, narrow: true, bottomSurface: true })).toBe('aboveSurface')
    expect(guideCaptionRoom({ ...showing, narrow: false, bottomSurface: false })).toBe('edge')
    expect(guideCaptionRoom({ ...showing, narrow: false, bottomSurface: true })).toBe(
      'aboveSurface',
    )
  })

  it('names no room while no caption shows', () => {
    expect(guideCaptionRoom({ captionShowing: false, narrow: true, bottomSurface: false })).toBe(
      null,
    )
  })
})

describe('framingTopInset', () => {
  it('starts a narrow eyeline frame one gap below the caption band', () => {
    const room = guideCaptionRoom({ captionShowing: true, narrow: true, bottomSurface: false })
    const bandBottom = PHONE_HEIGHT * CAPTION_EYELINE + BAND / 2
    const inset = topFor(room)

    expect(inset).toBe(Math.ceil(bandBottom + CAPTION_SURFACE_GAP_PX))
    expect(inset - bandBottom).toBeGreaterThanOrEqual(CAPTION_SURFACE_GAP_PX)
  })

  it('keeps the existing inset on a narrow screen with a bottom surface', () => {
    const room = guideCaptionRoom({ captionShowing: true, narrow: true, bottomSurface: true })
    expect(topFor(room)).toBe(TOP)
  })

  it('keeps the existing inset on a wide screen', () => {
    const room = guideCaptionRoom({ captionShowing: true, narrow: false, bottomSurface: false })
    expect(topFor(room)).toBe(TOP)
  })

  it('keeps the existing inset with no caption or an unmeasured band', () => {
    const narrowNoCaption = guideCaptionRoom({
      captionShowing: false,
      narrow: true,
      bottomSurface: false,
    })
    expect(topFor(narrowNoCaption)).toBe(TOP)
    expect(topFor('eyeline', 0)).toBe(TOP)
  })

  it('never lifts the frame above the existing inset', () => {
    expect(
      framingTopInset({
        top: 600,
        viewportHeight: 844,
        captionRoom: 'eyeline',
        captionBandHeight: 40,
      }),
    ).toBe(600)
  })
})
