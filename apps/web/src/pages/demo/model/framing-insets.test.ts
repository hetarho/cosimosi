import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { UNIVERSE_SKINS, resolveActiveSkin } from '@cosimosi/3d-renderer'
import { CAPTION_EYELINE, CAPTION_SURFACE_GAP_PX } from '@cosimosi/sequence'
import {
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
} from '@cosimosi/universe/scene'

import { framingTopInset, guideCaptionRoom } from './framing-insets.ts'
// The fit `SceneFraming` runs every frame. It is not on the renderer's public entry, so the test
// reads it from source to compose it with the page's inset.
import { fitSceneBounds } from '../../../../../../packages/3d-renderer/src/layers/scene-framing.ts'

const TOP = 96
const PHONE_HEIGHT = 844
const BAND = 108

function topFor(room: ReturnType<typeof guideCaptionRoom>, bandHeight = BAND) {
  return framingTopInset({
    top: TOP,
    viewport: { width: 390, height: PHONE_HEIGHT },
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
  it('puts a narrow eyeline top inset one gap below the caption band', () => {
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

  it.each([
    [667, 375, 82],
    [740, 360, 108],
  ])('keeps the existing inset on a narrow landscape screen (%s × %s)', (width, height, band) => {
    const room = guideCaptionRoom({ captionShowing: true, narrow: true, bottomSurface: false })
    expect(room).toBe('eyeline')
    expect(
      framingTopInset({
        top: TOP,
        viewport: { width, height },
        captionRoom: room,
        captionBandHeight: band,
      }),
    ).toBe(TOP)
  })

  it('still clears the band on a narrow portrait screen', () => {
    const room = guideCaptionRoom({ captionShowing: true, narrow: true, bottomSurface: false })
    const inset = framingTopInset({
      top: TOP,
      viewport: { width: 375, height: 667 },
      captionRoom: room,
      captionBandHeight: 82,
    })
    expect(inset).toBe(Math.ceil(667 * CAPTION_EYELINE + 82 / 2 + CAPTION_SURFACE_GAP_PX))
    expect(inset).toBeGreaterThan(TOP)
  })

  it('never lifts the frame above the existing inset', () => {
    expect(
      framingTopInset({
        top: 600,
        viewport: { width: 390, height: 844 },
        captionRoom: 'eyeline',
        captionBandHeight: 40,
      }),
    ).toBe(600)
  })
})

type Point = readonly [number, number, number]

// Screen y, in CSS pixels from the top, of a world point seen by a z-up perspective camera.
function screenY(point: Point, eye: Point, target: Point, fov: number, height: number): number {
  const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const cross = (a: Point, b: Point): Point => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const unit = (a: Point): Point => {
    const length = Math.hypot(...a)
    return [a[0] / length, a[1] / length, a[2] / length]
  }
  const forward = unit(sub(target, eye))
  const up = cross(unit(cross(forward, [0, 0, 1])), forward)
  const relative = sub(point, eye)
  const ndcY = dot(relative, up) / (dot(relative, forward) * Math.tan((fov * Math.PI) / 360))
  return ((1 - ndcY) * height) / 2
}

describe('the overview framed under an eyeline caption', () => {
  it('keeps every corner of a tall scene at or below the caption band at 390 × 844', () => {
    // A tall scene: memories spread wide with gists lifted high above them.
    const bounds = { min: [-28, -24, -16] as Point, max: [28, 24, 74] as Point }
    const fov = UNIVERSE_SKINS[resolveActiveSkin(VALUES.rendering.activeSkin)].camera.fov
    const room = guideCaptionRoom({ captionShowing: true, narrow: true, bottomSurface: false })
    const top = topFor(room)
    const bandBottom = PHONE_HEIGHT * CAPTION_EYELINE + BAND / 2

    const fit = fitSceneBounds(
      bounds,
      390,
      PHONE_HEIGHT,
      fov,
      UNIVERSE_ARRIVAL_CAMERA_POSITION,
      { left: 24, top, right: 24, bottom: 128 },
      Math.hypot(...UNIVERSE_ARRIVAL_CAMERA_POSITION),
      UNIVERSE_CAMERA_ENVELOPE.maxDistance,
    )
    const eye = fit.position.toArray() as Point
    const target = fit.target.toArray() as Point
    const ys = Array.from({ length: 8 }, (_, corner) =>
      screenY(
        [
          corner & 1 ? bounds.max[0] : bounds.min[0],
          corner & 2 ? bounds.max[1] : bounds.min[1],
          corner & 4 ? bounds.max[2] : bounds.min[2],
        ],
        eye,
        target,
        fov,
        PHONE_HEIGHT,
      ),
    )

    expect(Math.min(...ys)).toBeGreaterThanOrEqual(bandBottom + CAPTION_SURFACE_GAP_PX - 0.001)
    expect(Math.max(...ys)).toBeLessThanOrEqual(PHONE_HEIGHT - 128 + 0.001)
  })
})
