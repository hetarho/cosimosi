/** Linear-light sRGB channels, each nominally in `[0, 1]`; out-of-gamut light may fall outside. */
export type LinearRgb = readonly [number, number, number]

/** One display-encoded sRGB channel in `[0, 1]` with the transfer curve undone. */
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

/**
 * One linear channel display-encoded into `[0, 1]`. Light outside the cube is clamped first, so an
 * out-of-gamut request lands on the nearest displayable value rather than wrapping.
 */
export function encodeLinear(channel: number): number {
  return linearToSrgb(Math.max(0, Math.min(1, channel)))
}

/**
 * `#rrggbb` as linear light — what the renderer adds and luminance measures, not what the display
 * encodes. The caller guarantees the six-digit form.
 */
export function hexToLinearRgb(hex: string): [number, number, number] {
  return [
    srgbToLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
  ]
}

/** Linear light to the nearest 8-bit `#rrggbb`, clamping each channel into the cube. */
export function linearRgbToHex(rgb: LinearRgb): `#${string}` {
  const hex = rgb
    .map((channel) =>
      Math.round(encodeLinear(channel) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
  return `#${hex}`
}

/** WCAG relative luminance (Y) of linear-light sRGB. */
export function linearLuminance(rgb: LinearRgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}
