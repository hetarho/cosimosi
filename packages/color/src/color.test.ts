import { describe, expect, it } from 'vitest'

import {
  encodeLinear,
  hexToLinearRgb,
  linearLuminance,
  linearRgbToHex,
  linearRgbToOkLab,
  okLabToLinearRgb,
  okLabToOkLch,
  okLchToOkLab,
  srgbToLinear,
} from './index.ts'

// Golden values were recorded from the emotion, universe and ui implementations this package
// replaced, so a gamma or matrix change shows up here before it reaches stars, palettes or contrast.
const GOLDEN = [
  {
    hex: '#ff0010',
    linear: [1, 0, 0.005181516702338386],
    lab: { l: 0.6283808504847604, a: 0.22635660523406703, b: 0.12187486919596535 },
    lch: { l: 0.6283808504847604, c: 0.2570813032381486, h: 28.298900070034783 },
    luminance: 0.21297410550590884,
  },
  {
    hex: '#787878',
    linear: [0.18782077230067787, 0.18782077230067787, 0.18782077230067787],
    lab: { l: 0.5726833250271132, a: 4.6360582039994824e-11, b: 2.1346145406830885e-8 },
    lch: { l: 0.5726833250271132, c: 2.134619575083894e-8, h: 89.87556247464912 },
    luminance: 0.1878207723006779,
  },
  {
    hex: '#0a3cee',
    linear: [0.003035269835488375, 0.04518620438567554, 0.8549926081242338],
    lab: { l: 0.4780976927296139, a: -0.025842102082242524, b: -0.26304373994608 },
    lch: { l: 0.4780976927296139, c: 0.26431008941175516, h: 264.3891185186403 },
    luminance: 0.09469293805022966,
  },
] as const

describe('sRGB transfer', () => {
  it('parses hex to linear rgb in 0..1 (black and white anchors)', () => {
    expect(hexToLinearRgb('#000000')).toEqual([0, 0, 0])
    expect(hexToLinearRgb('#ffffff')).toEqual([1, 1, 1])
  })

  it('keeps the linear segment below the 0.04045 knee', () => {
    expect(srgbToLinear(0.04)).toBe(0.04 / 12.92)
    expect(srgbToLinear(10 / 255)).toBe(10 / 255 / 12.92)
  })

  it('clamps out-of-cube light before encoding', () => {
    expect(encodeLinear(-0.2)).toBe(0)
    expect(encodeLinear(1.4)).toBe(encodeLinear(1))
    expect(linearRgbToHex([1.3, -0.1, 0.5])).toBe(linearRgbToHex([1, 0, 0.5]))
  })

  it.each(GOLDEN)('matches the recorded linear channels and luminance of $hex', (golden) => {
    expect(hexToLinearRgb(golden.hex)).toEqual(golden.linear)
    expect(linearLuminance(golden.linear)).toBe(golden.luminance)
  })

  it('measures black as 0 and white as 1', () => {
    expect(linearLuminance(hexToLinearRgb('#000000'))).toBe(0)
    expect(linearLuminance(hexToLinearRgb('#ffffff'))).toBeCloseTo(1, 5)
  })
})

describe('OKLab', () => {
  it.each(GOLDEN)('matches the recorded OkLab and OkLCH of $hex', (golden) => {
    const lab = linearRgbToOkLab(golden.linear)
    expect(lab).toEqual(golden.lab)
    expect(okLabToOkLch(lab)).toEqual(golden.lch)
  })

  it.each(GOLDEN)('round-trips $hex through OkLab to the same 8-bit hex', (golden) => {
    expect(linearRgbToHex(okLabToLinearRgb(linearRgbToOkLab(hexToLinearRgb(golden.hex))))).toBe(
      golden.hex,
    )
  })

  it('reports out-of-gamut requests as channels outside the cube', () => {
    const recorded = [0.2060680419267093, 0.4286683357950984, 0.11888374662252366]
    okLabToLinearRgb(okLchToOkLab({ l: 0.7, c: 0.12, h: 135 })).forEach((channel, index) => {
      expect(channel).toBeCloseTo(recorded[index] ?? Number.NaN, 12)
    })
    const tooVivid = okLabToLinearRgb(okLchToOkLab({ l: 0.9, c: 0.35, h: 264 }))
    expect(tooVivid.some((channel) => channel < 0 || channel > 1)).toBe(true)
  })

  it('normalizes hue into [0, 360)', () => {
    expect(okLabToOkLch({ l: 0.5, a: 0.1, b: -0.1 }).h).toBeCloseTo(315, 9)
    expect(okLchToOkLab({ l: 0.5, c: 0, h: 42 })).toEqual({ l: 0.5, a: 0, b: 0 })
  })
})
