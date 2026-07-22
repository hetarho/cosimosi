import { describe, expect, it } from 'vitest'

import { buildEmotionGradientTexture } from './emotion-gradient.ts'

// The ramp's priority semantics: band WIDTH follows weight, band DEPTH follows rank — the primary
// emotion paints at full color, lesser emotions fade toward the bare night base.

const NIGHT_BASE = [10, 10, 18] as const

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
  it('paints a single emotion at full strength across the whole ramp', () => {
    const texture = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    expect(pixel(texture, 0.1)).toEqual([255, 0, 0])
    expect(pixel(texture, 0.9)).toEqual([255, 0, 0])
    texture.dispose()
  })

  it('keeps the primary at full color and fades lesser emotions toward the night base', () => {
    // Red holds 2/3 of the universe, blue 1/3 — blue sits at half the primary's priority.
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 2 },
      { color: '#0000ff', weight: 1 },
    ])
    expect(pixel(texture, 0.05)).toEqual([255, 0, 0])
    expect(pixel(texture, 0.95)).toEqual(faded([0, 0, 255], 0.5))
    texture.dispose()
  })

  it('paints equal-priority emotions all at full strength', () => {
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 1 },
      { color: '#0000ff', weight: 1 },
    ])
    expect(pixel(texture, 0.05)).toEqual([255, 0, 0])
    expect(pixel(texture, 0.95)).toEqual([0, 0, 255])
    texture.dispose()
  })
})
