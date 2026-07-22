import { abs, clamp, exp2, float, log2, pow, vec3 } from 'three/tsl'

import { asFloatNode } from '../../tsl'
import { fbm01 } from '../../shader-art/noise'
import { sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Ferrofluid — react-bits' Ferrofluid (a magnetic-fluid field whose two flow branches `smin`-merge
// into a peak field, a thin contour band around the crest lit as a glossy rim) mapped SEAMLESSLY
// onto the sphere. The two peak branches are 3D fbm on the surface direction (not the source's 2D
// value-noise grid, which seams at the equirect wrap), merged with the source's exponential smin;
// the rim + the `h`-from-branch-difference color are kept. Color is the emotion ramp, so the
// magnetic ridges glow in bands of feeling.

const FLUIDITY = 0.1
const RIM_WIDTH = 0.2
const SHIMMER = 1.5
const SHARPNESS = 2.5
const GLOW = 2

/** Exponential smooth-min (the source's `smin`) — merges the two flow branches like fluid. */
function smin(a: unknown, b: unknown, k: number) {
  const r = exp2(asFloatNode(a).mul(-1 / k)).add(exp2(asFloatNode(b).mul(-1 / k)))
  return log2(r).mul(-k)
}

export function ferrofluidSkyNode({ gradient, time }: SkyNodeArgs) {
  const dir = skyDir()
  const flow = vec3(0, 0, skySeconds(time, 0.15).mul(0.3))

  const peaks = fbm01(dir.mul(2.6).add(flow), { octaves: 4 })
  const peaks2 = fbm01(
    dir
      .mul(2.6)
      .add(vec3(5.2, 1.3, 0))
      .add(flow.mul(1.3)),
    { octaves: 4 },
  )
  const merged = smin(peaks, peaks2, FLUIDITY)

  // thin contour band around the crest, minus a shimmer noise, sharpened into a glossy rim
  const band = float(RIM_WIDTH)
    .sub(abs(merged.sub(0.5).mul(2)))
    .mul(5)
  const shimmer = fbm01(dir.mul(4).add(flow)).mul(SHIMMER)
  const lit = pow(clamp(band.sub(shimmer), float(0), float(1)), SHARPNESS).mul(GLOW)

  // color from the branch difference (the source's `h`)
  const h = clamp(peaks.sub(peaks2).mul(1.2).add(0.5), float(0), float(1))
  const col = sampleRamp(gradient, h)

  // The body fades to BLACK away from the crests instead of sitting at a flat fill: the peak field
  // itself is the gradient (cubed so troughs sink to pure night), so only the ridges carry colour
  // and the bare background shows through the valleys — the lit rim stays the sparkle on top.
  const bodyFade = pow(clamp(merged, float(0), float(1)), 3).mul(0.22)
  return clamp(col.mul(bodyFade).add(col.mul(lit)), float(0), float(1))
}
