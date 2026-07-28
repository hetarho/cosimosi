import { float, fract, smoothstep } from 'three/tsl'

import { skyCells, skyDir } from './sky-domain.ts'
import { emotionAnchors, emotionField } from './sky-emotion.ts'
import { markSize, skyFinish, skyQuantize, skyRing } from './sky-finish.ts'
import { floatAcc, skySeconds, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// PixelBlast — a field of pixel cells, pulsing in rings that expand from each feeling.
//
// domain   spherical cells for the pixels, angular distance from each feeling's anchor for the rings
// field    the cell distance, quantized into a dot mask
// emotion  one ring source per feeling, at its own anchor and in its own colour
// finish   ring WIDTH from the feeling's weight — never its opacity
//
// WIDTH, NOT ALPHA. A ring's weight is spent on how thick it is, never on how transparent. A ring drawn
// at an alpha taken from its colour's luminance does not read as faint — it reads as a ring blinking out
// of existence and back as the pulse crosses the threshold of visibility. A thin ring at full colour is
// legible at any weight, and it says what weight actually means: a small amount of something, not a
// ghost of it.
//
// No chart either. Cells tile the sphere directly and each ring expands from its own anchor, so nothing
// converges at a point and every feeling has a source of its own instead of sharing one at the centre of
// the view.

/** Cells across the sphere — the pixel resolution. */
const CELL_SCALE = 26
/** Quantization levels of the dot mask, which is what makes a cell read as a pixel. */
const DOT_STEPS = 3
/** Ring spacing, in radians of arc. */
const RING_GAP = 0.42
/** Rings drawn outward from each anchor. */
const RINGS = 4
/** Widest and narrowest ring, as a fraction of the gap. */
const WIDTH_MAX = 0.5
const WIDTH_MIN = 0.12

export function pixelBlastSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, 1)
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 2 })
  const anchors = emotionAnchors(Math.max(1, count))

  // The pixel grid: spherical cells, quantized so a cell is a flat dot rather than a smooth blob.
  const cell = skyCells(dir, CELL_SCALE)
  const dot = skyQuantize(smoothstep(float(0.55), float(0.12), cell), DOT_STEPS)

  let col = vec3Acc()
  for (let i = 0; i < anchors.length; i++) {
    const share = emotion.weights[i] ?? 1 / anchors.length
    const width = RING_GAP * markSize(share, { min: WIDTH_MIN, max: WIDTH_MAX })
    const angle = emotion.angleTo(i)

    let pulse = floatAcc()
    for (let r = 0; r < RINGS; r++) {
      // Rings march outward: the radius scrolls with time and wraps, so each anchor keeps emitting.
      const radius = fract(t.mul(0.12).add(r / RINGS)).mul(RING_GAP * RINGS)
      pulse = pulse.add(skyRing(angle, radius, width))
    }
    col = col.add(emotion.colorOf(i).mul(pulse).mul(dot))
  }

  return skyFinish(col.mul(0.9), { contrast: 1.05, grain: 0.02, headroom })
}
