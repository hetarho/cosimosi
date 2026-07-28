import { abs, clamp, exp2, float, log2, pow, vec3 } from 'three/tsl'

import { fbm01 } from '../../shader-art/noise'
import { asFloatNode } from '../../tsl'
import { skyDir, skyDrift } from './sky-domain.ts'
import { emotionField } from './sky-emotion.ts'
import { skyFinish } from './sky-finish.ts'
import { skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Ferrofluid — a magnetic fluid drawn into ridges, lit along their crests.
//
// domain   the surface direction, drifting
// field    two fbm branches merged by an exponential smooth-min, which is what pulls the fluid into
//          ridges instead of blobs; a third sample shimmers the rim
// emotion  the territory blend, so a ridge carries the feeling of the region it crosses
// finish   the fluid's own body gates how much sky it claims, under the headroom
//
// It carries ONE feeling by design and fills a good deal of the sky: the fluid is the subject here, so
// its body reaches well past the crests and only the deepest troughs fall back to bare night. A thin
// crust of fluid over a mostly-empty sky read as a crack rather than a substance.

const FLUIDITY = 0.1
const RIM_WIDTH = 0.2
const SHIMMER = 1.5
const SHARPNESS = 2.5
const GLOW = 2
/** How much of the sky the fluid's body occupies before the rim is added on top. */
const BODY_REACH = 0.62
/** Troughs below this sink to bare night, so the fluid still reads as a body with edges. */
const TROUGH_FLOOR = 1.35

/** Exponential smooth-min — merges the two flow branches the way fluid merges. */
function smin(a: unknown, b: unknown, k: number) {
  const r = exp2(asFloatNode(a).mul(-1 / k)).add(exp2(asFloatNode(b).mul(-1 / k)))
  return log2(r).mul(-k)
}

export function ferrofluidSkyNode({ gradient, time, count, weights, headroom }: SkyNodeArgs) {
  const dir = skyDir()
  const t = skySeconds(time, 0.15).mul(0.3)
  const flowed = skyDrift(dir.mul(2.6), t, [0, 0, 1])

  const peaks = fbm01(flowed, { octaves: 4 })
  const peaks2 = fbm01(flowed.add(vec3(5.2, 1.3, 0)), { octaves: 4 })
  const merged = smin(peaks, peaks2, FLUIDITY)

  // A thin contour band around the crest, less a shimmer, sharpened into a glossy rim.
  const band = float(RIM_WIDTH)
    .sub(abs(merged.sub(0.5).mul(2)))
    .mul(5)
  const shimmer = fbm01(skyDrift(dir.mul(4), t, [0, 0, 1])).mul(SHIMMER)
  const lit = pow(clamp(band.sub(shimmer), float(0), float(1)), SHARPNESS).mul(GLOW)

  const emotion = emotionField({ gradient, count, weights, dir, sharpness: 1.6 })

  // The peak field IS the body's gradient. A gentler exponent than a cube keeps the fluid spread
  // across the sky while the lowest troughs still fall away to night.
  const body = pow(clamp(merged, float(0), float(1)), TROUGH_FLOOR).mul(BODY_REACH)
  return skyFinish(emotion.color.mul(body).add(emotion.color.mul(lit)), {
    contrast: 1.05,
    grain: 0.03,
    headroom,
  })
}
