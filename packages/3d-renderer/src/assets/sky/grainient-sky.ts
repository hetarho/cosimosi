import { clamp, float, sin, vec3 } from 'three/tsl'

import { gnoise } from '../../shader-art/noise'
import { sampleRamp, skyDir, skyFinish, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// Grainient — react-bits' Grainient (a warped, grain-lit multi-color gradient) mapped SEAMLESSLY
// onto the sphere: its warped sample coordinate is built from the 3D surface direction, not the flat
// equirect UV, so the marble wraps with no seam and no pole pinch. We keep the source's shape — a
// noise-warped frame folded by sine warps, its diagonal read as color — and swap the three fixed
// hues for the emotion ramp, so more emotions cut more color zones into the same swirl.

export function grainientSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 0.25)
  const p = skyDir().mul(1.8)

  // noise-driven swirl of the sample frame (the shader's signature organic turn), in 3D
  const swirl = gnoise(p.add(vec3(0, 0, t.mul(0.4))))
  const wx = p.x.add(sin(p.y.mul(3).add(t)).mul(0.25)).add(swirl.mul(0.4))
  const wy = p.y.add(sin(p.z.mul(3.5).add(t)).mul(0.3)).add(swirl.mul(0.3))
  const wz = p.z.add(sin(p.x.mul(2.5).sub(t)).mul(0.25))

  // warped diagonal coordinate → the emotion palette ramp
  const g = clamp(
    wx.mul(0.5).add(wy.mul(0.35)).add(wz.mul(0.25)).mul(0.5).add(0.5),
    float(0),
    float(1),
  )
  return skyFinish(sampleRamp(gradient, g), { contrast: 1.15, grain: 0.05 })
}
