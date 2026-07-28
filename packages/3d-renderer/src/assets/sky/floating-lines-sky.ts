import { abs, float, max, sin } from 'three/tsl'

import { skyBand, skyDir, skyTangentFrame } from './sky-domain.ts'
import { emotionAnchors, emotionField } from './sky-emotion.ts'
import { markSize, skyFinish } from './sky-finish.ts'
import { skySeconds, vec3Acc, type SkyNodeArgs } from './sky-node.ts'

// FloatingLines — glowing filaments threading the sky, several per feeling.
//
// domain   great-circle bands about each feeling's own axis; a filament is a band, so it circles the
//          sphere and has no ends
// field    a sine wave riding along the band, its amplitude breathing
// emotion  one BUNDLE per feeling, at that feeling's anchor and in that feeling's own colour
// finish   width from the feeling's weight, under the headroom
//
// NO CHART, AND MORE LINES. Both changes come from the same place. The old stack was a row of lines
// on a flattened chart, so it converged where the chart gathered and the row could only be as long as
// the count — one line per feeling, which read as a sparse handful. A band about an axis has no ends
// and no gather, and a feeling can therefore carry a BUNDLE of them: the sky is threaded rather than
// ruled. Weight decides how many strands a feeling gets and how thick they are, never how faint.

/** Strands in the strongest feeling's bundle, and in the faintest one's. */
const STRANDS_MAX = 5
const STRANDS_MIN = 2
/** Angular spacing between strands within a bundle. */
const STRAND_GAP = 0.19
/** Core half-width of a strand, before its feeling's weight scales it. */
const STRAND_CORE = 0.016

/** One glowing filament: the band coordinate offset by a travelling sine, read as a thin bright core. */
function filament(band: unknown, offset: number, t: unknown, width: number) {
  const tt = float(t as never)
  const amp = sin(tt.mul(0.2).add(offset)).mul(0.06).add(0.1)
  const wave = sin(
    tt
      .mul(0.1)
      .add(offset)
      .add(skyBand(skyDir(), [0.4, 0.2, 0.89]).mul(3)),
  ).mul(amp)
  const distance = abs(float(band as never).sub(wave))
  return float(width)
    .div(max(distance.add(0.01), float(1e-3)))
    .add(0.01)
}

export function floatingLinesSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, 1)
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.5 })
  const anchors = emotionAnchors(Math.max(1, count))

  let col = vec3Acc()
  for (let i = 0; i < anchors.length; i++) {
    // A bundle rides the bands about this feeling's own axis, so bundles cross rather than stack.
    const axis = skyTangentFrame(anchors[i]).tangent
    const band = skyBand(dir, axis)
    const share = emotion.weights[i] ?? 1 / anchors.length
    const strands = Math.max(
      STRANDS_MIN,
      Math.round(markSize(share, { min: STRANDS_MIN / STRANDS_MAX, max: 1 }) * STRANDS_MAX),
    )
    const width = STRAND_CORE * markSize(share, { min: 0.55, max: 1 })

    for (let s = 0; s < strands; s++) {
      const offset = STRAND_GAP * (s - (strands - 1) / 2)
      col = col.add(
        emotion.colorOf(i).mul(filament(band.sub(offset), 2 + 0.15 * i + 0.6 * s, t, width)),
      )
    }
  }

  return skyFinish(col.mul(0.34), { contrast: 1.02, grain: 0.02, headroom })
}
