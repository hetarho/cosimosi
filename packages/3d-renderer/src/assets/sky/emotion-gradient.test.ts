import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { buildEmotionGradientTexture } from './emotion-gradient.ts'

// The ramp's priority semantics: band WIDTH follows weight, band DEPTH follows weight too but on a
// steeper curve. The full palette stays under a shared exposure ceiling without count-based
// attenuation; lesser emotions then fade toward the bare night base as
// `(share / topShare) ** DEPTH_CURVE`.

const NIGHT_BASE = [10, 10, 18] as const

/** Mirror of the ramp's depth-fade exponent (see emotion-gradient.ts). */
const DEPTH_CURVE = 1.5
const EXPOSURE = VALUES.rendering.emotionSkyExposure

/** Read the ramp pixel nearest to t∈[0,1]. */
function pixel(texture: ReturnType<typeof buildEmotionGradientTexture>, t: number) {
  const data = texture.image.data as Uint8Array
  const o = Math.min(255, Math.floor(t * 256)) * 4
  return [data[o], data[o + 1], data[o + 2]]
}

/** The expected band color for a full color faded to `strength` (the ramp's own mix + rounding). */
function faded(color: readonly [number, number, number], strength: number) {
  return color.map((c, i) =>
    Math.round((NIGHT_BASE[i] ?? 0) + (c - (NIGHT_BASE[i] ?? 0)) * strength),
  )
}

describe('emotion gradient ramp', () => {
  it('keeps a single emotion under the sky exposure ceiling across the whole ramp', () => {
    const texture = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    expect(pixel(texture, 0.1)).toEqual(faded([255, 0, 0], EXPOSURE))
    expect(pixel(texture, 0.9)).toEqual(faded([255, 0, 0], EXPOSURE))
    texture.dispose()
  })

  it('keeps the primary deepest and fades lesser emotions toward the night base', () => {
    // Red holds 2/3 of the universe, blue 1/3 — blue sits at half the primary's priority.
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 2 },
      { color: '#0000ff', weight: 1 },
    ])
    expect(pixel(texture, 0.05)).toEqual(faded([255, 0, 0], EXPOSURE))
    expect(pixel(texture, 0.95)).toEqual(faded([0, 0, 255], EXPOSURE * 0.5 ** DEPTH_CURVE))
    texture.dispose()
  })

  it('keeps equal-priority colors visible under the shared exposure ceiling', () => {
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 1 },
      { color: '#0000ff', weight: 1 },
    ])
    expect(pixel(texture, 0.05)).toEqual(faded([255, 0, 0], EXPOSURE))
    expect(pixel(texture, 0.95)).toEqual(faded([0, 0, 255], EXPOSURE))
    texture.dispose()
  })

  it('does not collapse a many-emotion equal-priority gradient toward the night base', () => {
    const texture = buildEmotionGradientTexture(
      Array.from({ length: 13 }, (_, index) => ({
        color: index % 2 === 0 ? '#ff0000' : '#0000ff',
        weight: 1,
      })),
    )
    expect(pixel(texture, 0.01)).toEqual(faded([255, 0, 0], EXPOSURE))
    const blueBand = pixel(texture, 0.12)
    expect(blueBand[0]).toBeLessThan(10)
    expect(blueBand[2]).toBeGreaterThan(150)
    texture.dispose()
  })
})
