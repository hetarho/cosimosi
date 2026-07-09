import { clamp, float, floor, fract, sin, step, vec3 } from 'three/tsl'

import { hash13, sampleRamp, skyDir, skySeconds, type SkyNodeArgs } from './sky-node.ts'

// PixelSnow — a sphere-adapted approximation. The react-bits original is a 3D voxel raymarch of
// drifting flakes; we keep that VOXEL idea but mapped SEAMLESSLY — the cells are floored from the 3D
// surface direction (not the equirect UV, which seams), so blocky flakes drift over the whole sky
// with no wrap line. A per-cell hash scatters them, a twinkle pulses them, and the emotion ramp
// tints them. Reads best on one or two emotions (snow is near-monochrome), a second hue frosting a
// few flakes.

const RES = 36

export function pixelSnowSkyNode({ gradient, time }: SkyNodeArgs) {
  const t = skySeconds(time, 1)

  // drift the 3D cell frame: a little wind + a steady fall
  const cell = floor(
    skyDir()
      .mul(RES)
      .add(vec3(t.mul(0.05), t.mul(-0.4), 0)),
  )
  const rnd = hash13(cell)

  const flake = step(0.9, rnd) // ~10% of cells hold a flake
  const twinkle = sin(t.mul(3).add(rnd.mul(6.28)))
    .mul(0.5)
    .add(0.5)
  const bright = flake.mul(twinkle)

  const flakeCol = sampleRamp(gradient, fract(rnd.mul(1.3)))
  const bg = sampleRamp(gradient, float(0.5)).mul(0.03)
  return clamp(bg.add(flakeCol.mul(bright)), float(0), float(1))
}
