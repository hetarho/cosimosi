import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { buildEmotionGradientTexture } from './emotion-gradient.ts'

// The ramp's one semantic: an emotion's weight buys it band WIDTH and nothing else. Every band
// reaches the same depth under a shared exposure ceiling, at every count, so a faint feeling is a
// narrow stripe of its own colour rather than a washed-out one — a hue diluted toward the night is a
// hue nobody can name.

const NIGHT_BASE = [10, 10, 18] as const

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

  it('gives the primary a wider band without giving it a deeper colour', () => {
    // Red holds 2/3 of the universe, blue 1/3. Blue's band is half as wide and exactly as deep.
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 2 },
      { color: '#0000ff', weight: 1 },
    ])
    expect(pixel(texture, 0.05)).toEqual(faded([255, 0, 0], EXPOSURE))
    expect(pixel(texture, 0.95)).toEqual(faded([0, 0, 255], EXPOSURE))
    // Bands blend centre-to-centre (red's at 1/3, blue's at 5/6), so each colour owns the ramp around
    // its own centre — the widths themselves are asserted against the layout in sky-emotion.test.ts.
    expect(pixel(texture, 0.4)[0]).toBeGreaterThan(pixel(texture, 0.4)[2])
    expect(pixel(texture, 0.7)[2]).toBeGreaterThan(pixel(texture, 0.7)[0])
    texture.dispose()
  })

  it('holds an almost-absent feeling at its own full colour', () => {
    // The failure this guards: a 3%-share emotion rendered as night-tinted mud, so its ring or line
    // blinks out of the sky instead of reading as a thin stripe of its colour.
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 97 },
      { color: '#0000ff', weight: 3 },
    ])
    expect(pixel(texture, 0.995)).toEqual(faded([0, 0, 255], EXPOSURE))
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
