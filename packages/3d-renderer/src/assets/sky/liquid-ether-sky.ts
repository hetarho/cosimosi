import { clamp, float, pow, vec3 } from 'three/tsl'

import { domainWarp } from '../../shader-art/field'
import { fbm01 } from '../../shader-art/noise'
import { sampleRamp, skyDir, skyFinish, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// LiquidEther — a sphere-adapted approximation, NOT a line-for-line port. The react-bits original
// is a real-time Navier–Stokes fluid simulation (multi-pass render targets) that cannot run as a
// single sky node. What carries over is its LOOK: dye smeared by a slow velocity field, marbling
// together. We recreate it with a time-advected domain warp of the 3D surface direction — so the
// flow wraps the whole sphere with no seam and no pole — sampling the emotion ramp, plus a ridge
// sheen for the liquid gloss. Richest across many emotions, which marble together.

export function liquidEtherSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 0.08)

  // advect the 3D sample frame by an fbm domain warp — the "velocity field" smearing the dye
  const warped = domainWarp(
    skyDir()
      .mul(2.4)
      .add(vec3(0, 0, t)),
    { amount: 1.2, octaves: 4 },
  )
  const flow = fbm01(warped.mul(0.5))
  const swirl = fbm01(warped.add(vec3(3.1, 1.7, 0)))
  const g = clamp(flow.mul(0.7).add(swirl.mul(0.3)), float(0), float(1))

  const base = sampleRamp(gradient, g)
  const sheen = pow(fbm01(warped.mul(2)), 3).mul(0.4)
  return skyFinish(base.add(base.mul(sheen)), { contrast: 1.08, grain: 0.02 })
}
