import { abs, exp, float, max, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise'
import { skyBand, skyDir, type SkyAnchor } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import { skySeconds, type SkyNodeArgs } from './sky-node.ts'

// SoftAurora — curtains of light hanging in the sky, each carrying a feeling.
//
// domain   great-circle bands about two tilted axes; a curtain is a band, so it has no ends and no
//          point to gather at
// field    gnoise warping each band, flared by an exponential ridge into a soft crest
// emotion  the territory blend read along the curtain, so a curtain changes feeling across its length
//          instead of being one flat tint
// finish   under the sky's headroom — the reason this recipe is authored at this brightness at all
//
// HEADROOM. This is the widest bright thing the sky can be, and the stars, the nebula field and the
// bloom pass all ADD their light on top of it. Addition over an already-bright surface passes 1 in
// every channel at once, which is white — so a star seen against a lit curtain lost its colour, and
// its whole neighbourhood with it. The curtains therefore hold themselves under a ceiling and leave
// the rest of the range for the light that lands on them.

const SCALE = 1.6
const SPREAD = 1.1
const BRIGHTNESS = 1.05

/** The two axes the curtains hang about — tilted apart so they cross rather than stack. */
const CURTAIN_AXES: readonly SkyAnchor[] = [
  [0.08, 0.99, 0.05],
  [-0.22, 0.95, 0.2],
]

/** One curtain: a band warped by 3D noise, flared by an exponential ridge into a soft crest. */
function curtain(dir: ReturnType<typeof skyDir>, t: unknown, axis: SkyAnchor, center: number) {
  const n = gnoise(dir.mul(SCALE).add(vec3(0, 0, t as never)))
  const band = skyBand(dir, axis).mul(2.2).sub(center)
  return max(
    exp(
      float(1)
        .sub(abs(n.add(band)).mul(1.1))
        .mul(SPREAD),
    ),
    float(0),
  ).mul(0.3)
}

export function softAuroraSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, 0.24)

  // One emotion field, read once. Each curtain multiplies it by its own crest, so where two curtains
  // overlap the feelings blend the way light does rather than one hue winning the pixel.
  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.4 })
  const crest = curtain(dir, t, CURTAIN_AXES[0], 0.35).add(
    curtain(dir, t.add(1.7), CURTAIN_AXES[1], -0.15),
  )

  return skyFinish(emotion.color.mul(crest).mul(BRIGHTNESS), {
    contrast: 1.04,
    grain: 0.02,
    headroom,
  })
}
